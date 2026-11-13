"""
Seed script — Populate Neo4j with sample entities and relationships.
Also logs activities into PostgreSQL.

Usage:
    python seed.py          (local)
    docker exec uip-backend python seed.py   (Docker)
"""

import os
import uuid
from datetime import datetime, timedelta
import random

from neo4j import GraphDatabase
import psycopg2

# ── Configuration ────────────────────────────────────────
NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "uip_neo4j_password")

# For PostgreSQL sync driver (psycopg2)
DB_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://uip_user:uip_password@localhost:5432/uip_db")
# Convert asyncpg URL to psycopg2 format
PG_DSN = DB_URL.replace("postgresql+asyncpg://", "postgresql://")

# ── Entity Definitions ──────────────────────────────────
ENTITIES = [
    # Plants
    {"name": "Rice", "type": "Plant", "description": "Oryza sativa — staple cereal crop for over half the world's population. Requires flooded paddy fields and warm climate.",
     "properties": {"scientific_name": "Oryza sativa", "family": "Poaceae", "origin": "Asia"}},
    {"name": "Wheat", "type": "Plant", "description": "Triticum aestivum — globally cultivated cereal grain, primary ingredient in bread and pasta.",
     "properties": {"scientific_name": "Triticum aestivum", "family": "Poaceae", "origin": "Fertile Crescent"}},
    {"name": "Tomato", "type": "Plant", "description": "Solanum lycopersicum — widely cultivated nightshade fruit used in cuisines worldwide.",
     "properties": {"scientific_name": "Solanum lycopersicum", "family": "Solanaceae", "origin": "South America"}},
    {"name": "Maize", "type": "Plant", "description": "Zea mays — versatile cereal grain used for food, animal feed, and biofuel production.",
     "properties": {"scientific_name": "Zea mays", "family": "Poaceae", "origin": "Mesoamerica"}},
    {"name": "Soybean", "type": "Plant", "description": "Glycine max — major protein and oil crop with nitrogen-fixing capabilities.",
     "properties": {"scientific_name": "Glycine max", "family": "Fabaceae", "origin": "East Asia"}},

    # Animals
    {"name": "Cattle", "type": "Animal", "description": "Bos taurus — domesticated bovine raised for dairy, meat, and leather production worldwide.",
     "properties": {"scientific_name": "Bos taurus", "class": "Mammalia", "domesticated": True}},
    {"name": "Honey Bee", "type": "Animal", "description": "Apis mellifera — critical pollinator species responsible for pollinating approximately 75% of flowering plants.",
     "properties": {"scientific_name": "Apis mellifera", "class": "Insecta", "role": "pollinator"}},
    {"name": "Chicken", "type": "Animal", "description": "Gallus gallus domesticus — most widely farmed poultry species for eggs and meat.",
     "properties": {"scientific_name": "Gallus gallus", "class": "Aves", "domesticated": True}},
    {"name": "Salmon", "type": "Animal", "description": "Salmo salar — anadromous fish species important in aquaculture and wild fisheries.",
     "properties": {"scientific_name": "Salmo salar", "class": "Actinopterygii", "habitat": "freshwater/marine"}},

    # Diseases
    {"name": "Wheat Rust", "type": "Disease", "description": "Fungal infection caused by Puccinia triticina, resulting in significant wheat crop losses worldwide.",
     "properties": {"pathogen": "Puccinia triticina", "affects": "cereals", "transmission": "airborne spores"}},
    {"name": "Avian Influenza", "type": "Disease", "description": "Highly pathogenic H5N1 virus affecting poultry and wild birds, with zoonotic potential.",
     "properties": {"pathogen": "H5N1", "affects": "birds", "zoonotic": True}},
    {"name": "Late Blight", "type": "Disease", "description": "Devastating oomycete disease caused by Phytophthora infestans affecting tomatoes and potatoes.",
     "properties": {"pathogen": "Phytophthora infestans", "affects": "solanaceae", "historic": "Irish famine"}},
    {"name": "Mastitis", "type": "Disease", "description": "Inflammatory infection of mammary gland tissue in dairy cattle, causing economic losses.",
     "properties": {"pathogen": "various bacteria", "affects": "dairy cattle", "economic_impact": "high"}},

    # Chemicals
    {"name": "Glyphosate", "type": "Chemical", "description": "Broad-spectrum systemic herbicide widely used in agriculture. Active ingredient in Roundup.",
     "properties": {"formula": "C3H8NO5P", "type": "herbicide", "mode": "EPSPS inhibitor"}},
    {"name": "Nitrogen Fertilizer", "type": "Chemical", "description": "Synthetic ammonium-based fertilizer produced via Haber-Bosch process, essential for modern agriculture.",
     "properties": {"primary_element": "N", "type": "fertilizer", "process": "Haber-Bosch"}},
    {"name": "Neonicotinoid", "type": "Chemical", "description": "Systemic insecticide class linked to pollinator decline, restricted in many regions.",
     "properties": {"type": "insecticide", "target": "insects", "controversy": "bee decline"}},
    {"name": "Potassium Chloride", "type": "Chemical", "description": "Muriate of potash (KCl) — major potassium fertilizer for crop nutrition.",
     "properties": {"formula": "KCl", "type": "fertilizer", "nutrient": "K"}},

    # Climate
    {"name": "El Niño", "type": "Climate", "description": "Periodic warming of Pacific Ocean surface waters causing global weather pattern disruptions.",
     "properties": {"cycle": "2-7 years", "impact": "global", "type": "oscillation"}},
    {"name": "Monsoon Season", "type": "Climate", "description": "Seasonal wind reversal bringing heavy rainfall to South and Southeast Asia, critical for agriculture.",
     "properties": {"region": "South Asia", "duration": "June-September", "impact": "agricultural"}},
    {"name": "Drought Stress", "type": "Climate", "description": "Extended period of water deficit affecting plant growth, crop yield, and ecosystem health.",
     "properties": {"type": "abiotic stress", "impact": "crop failure", "frequency": "increasing"}},
    {"name": "Frost Event", "type": "Climate", "description": "Sub-zero temperature occurrence damaging plant tissues and causing crop losses.",
     "properties": {"type": "abiotic stress", "threshold": "0°C", "impact": "tissue damage"}},

    # Soil
    {"name": "Laterite Soil", "type": "Soil", "description": "Iron and aluminium-rich tropical soil found in hot and wet regions, poor in nutrients.",
     "properties": {"region": "tropical", "pH": "acidic", "fertility": "low"}},
    {"name": "Alluvial Soil", "type": "Soil", "description": "Fertile soil deposited by rivers, excellent for agriculture. Found in major river deltas.",
     "properties": {"origin": "fluvial deposit", "fertility": "high", "texture": "loamy"}},
    {"name": "Black Cotton Soil", "type": "Soil", "description": "Vertisol with high clay content, swells when wet and cracks when dry. Ideal for cotton.",
     "properties": {"type": "vertisol", "clay": "high", "crop": "cotton"}},
    {"name": "Sandy Loam", "type": "Soil", "description": "Well-drained soil with balanced sand, silt, and clay proportions. Good root penetration.",
     "properties": {"texture": "sandy loam", "drainage": "good", "fertility": "moderate"}},
]

# ── Relationship Definitions ────────────────────────────
RELATIONSHIPS = [
    # Disease ➜ Crop
    {"source": "Wheat Rust", "target": "Wheat", "type": "affects", "description": "Wheat rust causes significant yield losses in wheat crops worldwide"},
    {"source": "Late Blight", "target": "Tomato", "type": "affects", "description": "Late blight destroys tomato foliage and fruit, causing total crop loss"},
    {"source": "Avian Influenza", "target": "Chicken", "type": "affects", "description": "H5N1 causes high mortality in poultry flocks"},
    {"source": "Mastitis", "target": "Cattle", "type": "affects", "description": "Mastitis reduces milk production and quality in dairy cattle"},

    # Climate ➜ Crop
    {"source": "Drought Stress", "target": "Rice", "type": "affects", "description": "Drought severely impacts rice yields due to high water requirements"},
    {"source": "Drought Stress", "target": "Maize", "type": "affects", "description": "Maize is particularly sensitive to drought during tasseling stage"},
    {"source": "El Niño", "target": "Wheat", "type": "affects", "description": "El Niño-related weather shifts disrupt wheat growing seasons"},
    {"source": "Monsoon Season", "target": "Rice", "type": "related_to", "description": "Monsoon rainfall is essential for paddy rice cultivation in Asia"},
    {"source": "Frost Event", "target": "Tomato", "type": "affects", "description": "Tomato plants are highly frost-sensitive; exposure kills tissue"},

    # Chemical ➜ Disease/Crop
    {"source": "Glyphosate", "target": "Soybean", "type": "related_to", "description": "Roundup Ready soybeans are engineered for glyphosate tolerance"},
    {"source": "Neonicotinoid", "target": "Honey Bee", "type": "affects", "description": "Neonicotinoids are linked to colony collapse disorder in bees"},
    {"source": "Nitrogen Fertilizer", "target": "Wheat", "type": "related_to", "description": "Nitrogen is the primary limiting nutrient for wheat yields"},
    {"source": "Nitrogen Fertilizer", "target": "Maize", "type": "related_to", "description": "Maize requires substantial nitrogen for optimal growth"},
    {"source": "Potassium Chloride", "target": "Soybean", "type": "related_to", "description": "Potassium is essential for soybean pod development"},

    # Soil ➜ Crop
    {"source": "Rice", "target": "Alluvial Soil", "type": "found_in", "description": "Rice thrives in fertile alluvial soils of river deltas"},
    {"source": "Wheat", "target": "Alluvial Soil", "type": "found_in", "description": "Wheat grows well in nutrient-rich alluvial soils"},
    {"source": "Maize", "target": "Sandy Loam", "type": "found_in", "description": "Maize prefers well-drained sandy loam soils"},
    {"source": "Soybean", "target": "Laterite Soil", "type": "found_in", "description": "Soybean can grow in laterite soil with proper amendment"},

    # Causation
    {"source": "Drought Stress", "target": "Wheat Rust", "type": "causes", "description": "Drought-stressed wheat becomes more susceptible to rust infection"},
    {"source": "El Niño", "target": "Drought Stress", "type": "causes", "description": "El Niño events trigger drought conditions in many regions"},

    # Treatment
    {"source": "Wheat Rust", "target": "Glyphosate", "type": "treated_by", "description": "Fungicides (not glyphosate) treat wheat rust; glyphosate controls weeds around infected areas"},

    # Cross-domain
    {"source": "Honey Bee", "target": "Tomato", "type": "related_to", "description": "Bees are important pollinators for tomato production"},
    {"source": "Cattle", "target": "Maize", "type": "depends_on", "description": "Cattle feed heavily depends on maize as a primary energy source"},
    {"source": "Chicken", "target": "Soybean", "type": "depends_on", "description": "Soybean meal is the primary protein source in poultry feed"},
    {"source": "Salmon", "target": "El Niño", "type": "related_to", "description": "El Niño affects ocean temperatures and salmon migration patterns"},
]


def seed_neo4j():
    """Create sample entities and relationships in Neo4j."""
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    driver.verify_connectivity()
    print("✓ Connected to Neo4j")

    entity_ids = {}  # name -> uuid

    with driver.session() as session:
        # Create constraint
        session.run("CREATE CONSTRAINT IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE")

        # Create entities
        now = datetime.utcnow()
        for i, entity in enumerate(ENTITIES):
            eid = str(uuid.uuid4())
            entity_ids[entity["name"]] = eid
            created_at = (now - timedelta(days=random.randint(1, 60), hours=random.randint(0, 23))).isoformat()

            import json
            session.run(
                f"""
                MERGE (e:Entity:{entity['type']} {{name: $name}})
                ON CREATE SET
                    e.id = $id,
                    e.type = $type,
                    e.description = $description,
                    e.properties = $properties,
                    e.created_at = $created_at,
                    e.source_document_id = null
                ON MATCH SET
                    e.id = coalesce(e.id, $id)
                """,
                id=eid,
                name=entity["name"],
                type=entity["type"],
                description=entity["description"],
                properties=json.dumps(entity["properties"]),
                created_at=created_at,
            )
            print(f"  ✓ Entity: {entity['name']} ({entity['type']})")

        # Create relationships
        for rel in RELATIONSHIPS:
            rid = str(uuid.uuid4())
            rel_type_upper = rel["type"].upper()
            created_at = (now - timedelta(days=random.randint(1, 30))).isoformat()

            session.run(
                f"""
                MATCH (src:Entity {{name: $source}})
                MATCH (tgt:Entity {{name: $target}})
                MERGE (src)-[r:{rel_type_upper} {{source_name: $source, target_name: $target}}]->(tgt)
                ON CREATE SET
                    r.id = $id,
                    r.type = $type,
                    r.description = $description,
                    r.created_at = $created_at
                """,
                id=rid,
                source=rel["source"],
                target=rel["target"],
                type=rel["type"],
                description=rel["description"],
                created_at=created_at,
            )
            print(f"  ✓ Relationship: {rel['source']} —[{rel['type']}]→ {rel['target']}")

    driver.close()
    print(f"\n✓ Seeded {len(ENTITIES)} entities and {len(RELATIONSHIPS)} relationships into Neo4j")
    return entity_ids


def seed_activities():
    """Log seed activities into PostgreSQL."""
    try:
        conn = psycopg2.connect(PG_DSN)
        cur = conn.cursor()

        # Get demo user id
        cur.execute("SELECT id FROM users WHERE email = 'demo@uip.local'")
        row = cur.fetchone()
        if not row:
            print("⚠ Demo user not found — skipping activity logs")
            conn.close()
            return

        user_id = row[0]
        now = datetime.utcnow()

        activities = [
            ("created", "entity", "seed", "Seeded knowledge graph with sample entities"),
            ("created", "relationship", "seed", "Created cross-domain relationships"),
            ("system", "system", "seed", "Knowledge graph initialized with agricultural and scientific data"),
            ("system", "system", "seed", "Platform ready for document upload and analysis"),
        ]

        for action, etype, eid, details in activities:
            created_at = now - timedelta(minutes=random.randint(1, 60))
            cur.execute(
                "INSERT INTO activities (action, entity_type, entity_id, details, user_id, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
                (action, etype, eid, details, user_id, created_at),
            )

        conn.commit()
        cur.close()
        conn.close()
        print("✓ Seeded activities into PostgreSQL")
    except Exception as e:
        print(f"⚠ PostgreSQL activity seed failed: {e}")


if __name__ == "__main__":
    print("═══════════════════════════════════════════")
    print("  Unified Intelligence Platform — Seeder")
    print("═══════════════════════════════════════════\n")
    seed_neo4j()
    print()
    seed_activities()
    print("\n✓ Seed complete!")
