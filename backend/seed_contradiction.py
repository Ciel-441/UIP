from neo4j import GraphDatabase

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "uip_neo4j_password")

def seed():
    with GraphDatabase.driver(URI, auth=AUTH) as driver:
        with driver.session() as session:
            # Create Contradiction
            session.run("""
            MERGE (t:Entity {name: 'Caffeine effect on Sleep', type: 'Topic'})
            MERGE (p1:Entity {name: 'Study A (Dr. Smith)', type: 'Paper'})
            MERGE (p2:Entity {name: 'Study B (Dr. Jones)', type: 'Paper'})
            MERGE (p1)-[:SUPPORTS {source_evidence: ['1']}]->(t)
            MERGE (p2)-[:CONTRADICTS {source_evidence: ['2']}]->(t)
            """)
            
            # Create Consensus
            session.run("""
            MERGE (t2:Entity {name: 'Climate Change Impact on Crops', type: 'Topic'})
            MERGE (p3:Entity {name: 'IPCC Report 2025', type: 'Paper'})
            MERGE (p4:Entity {name: 'Global Ag Study', type: 'Paper'})
            MERGE (p5:Entity {name: 'UN Food Security', type: 'Paper'})
            MERGE (p3)-[:SUPPORTS {source_evidence: ['3']}]->(t2)
            MERGE (p4)-[:SUPPORTS {source_evidence: ['4']}]->(t2)
            MERGE (p5)-[:SUPPORTS {source_evidence: ['5']}]->(t2)
            """)
            
            # Create Hypothesis Candidates
            session.run("""
            MERGE (a:Entity {name: 'Drought-Resistant Corn', type: 'Plant'})
            MERGE (b:Entity {name: 'Soil Microbiome X', type: 'Microorganism'})
            MERGE (common:Entity {name: 'Moisture Retention', type: 'Process'})
            MERGE (a)-[:RELATED_TO]->(common)
            MERGE (b)-[:AFFECTS]->(common)
            """)
            print("Successfully seeded Contradiction, Consensus, and Hypothesis candidates!")

if __name__ == "__main__":
    seed()
