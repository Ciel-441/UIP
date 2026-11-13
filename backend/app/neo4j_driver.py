from neo4j import GraphDatabase
from app.config import settings

neo4j_driver = None


def get_neo4j_driver():
    """Return the current Neo4j driver instance."""
    return neo4j_driver


def init_neo4j():
    """Initialize the Neo4j driver and create required constraints."""
    global neo4j_driver
    neo4j_driver = GraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
    )
    # Verify connectivity
    neo4j_driver.verify_connectivity()
    # Create uniqueness constraint on Entity.id
    with neo4j_driver.session() as session:
        session.run(
            "CREATE CONSTRAINT IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE"
        )


def close_neo4j():
    """Close the Neo4j driver if it is open."""
    global neo4j_driver
    if neo4j_driver is not None:
        neo4j_driver.close()
        neo4j_driver = None
