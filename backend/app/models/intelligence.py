from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    goal = Column(Text, nullable=False)
    status = Column(String, default="active") # active, completed, failed
    domain = Column(String, nullable=True) # e.g. agriculture, medicine
    findings = Column(JSON, default=list) # Array of key findings
    report_markdown = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    room = relationship("DataRoom")
    user = relationship("User")

class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    investigation_id = Column(Integer, ForeignKey("investigations.id", ondelete="CASCADE"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="emerging") # emerging, supported, strongly_supported, contradicted, rejected
    confidence = Column(Float, default=0.0)
    evidence = Column(JSON, default=list) # Array of citations/graph paths
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    room = relationship("DataRoom")
    investigation = relationship("Investigation")

class ExtractionRule(Base):
    __tablename__ = "extraction_rules"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    domain = Column(String, nullable=True)
    rule_text = Column(Text, nullable=False) # e.g. "Do not classify 'Water' as a Chemical"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("DataRoom")

class KnowledgeEvolution(Base):
    """Audit log tracking how relationships/consensus changes over time"""
    __tablename__ = "knowledge_evolution"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    relationship_id = Column(String, nullable=False) # Neo4j relationship ID or hash
    source_node = Column(String, nullable=False)
    target_node = Column(String, nullable=False)
    rel_type = Column(String, nullable=False)
    old_confidence = Column(Float, nullable=False)
    new_confidence = Column(Float, nullable=False)
    reason = Column(Text, nullable=True) # e.g. "Found 3 new supporting papers"
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("DataRoom")

class DomainSubscription(Base):
    __tablename__ = "domain_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    domain = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("DataRoom")

# ─── V0.5 Predictive Intelligence Models ──────────────────────────────────────

class DigitalTwin(Base):
    __tablename__ = "digital_twins"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    domain = Column(String, nullable=False)
    parameters = Column(JSON, default=dict) # E.g. {"baseline_rainfall": 100, "baseline_yield": 500}
    health_score = Column(Float, default=1.0) # 0.0 to 1.0 indicator of system stability
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    room = relationship("DataRoom")

class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    parameters = Column(JSON, default=dict) # E.g. {"rainfall_modifier": -0.2}
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("DataRoom")
    twin = relationship("DigitalTwin")

class Simulation(Base):
    __tablename__ = "simulations"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    scenario_ids = Column(JSON, default=list) # Array of scenario IDs compared
    status = Column(String, default="pending") # pending, running, completed, failed
    results = Column(JSON, default=dict) # Output from the SimulationAgent
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    room = relationship("DataRoom")

class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    twin_id = Column(Integer, ForeignKey("digital_twins.id", ondelete="CASCADE"), nullable=True)
    target_metric = Column(String, nullable=False)
    predicted_value = Column(String, nullable=False) # e.g. "Decreases by 15%"
    timeframe_days = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    assumptions = Column(JSON, default=list) # List of assumptions
    evidence = Column(JSON, default=list) # List of supporting evidence/relationships
    data_coverage = Column(Float, nullable=True) # % of domain covered by data
    actual_value = Column(String, nullable=True) # Populated later by Validation System
    validation_status = Column(String, default="pending") # pending, accurate, inaccurate
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("DataRoom")

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    target_type = Column(String, nullable=False) # "entity" or "relationship" or "twin"
    target_id = Column(String, nullable=False)
    risk_score = Column(Float, nullable=False) # 0.0 to 1.0 (1.0 = catastrophic)
    risk_type = Column(String, nullable=False) # e.g. "fragile_system", "single_point_failure"
    description = Column(Text, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("DataRoom")

class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("data_rooms.id", ondelete="CASCADE"), nullable=True, index=True)
    goal = Column(Text, nullable=False)
    recommended_actions = Column(JSON, default=list)
    predicted_impact = Column(JSON, default=dict)
    confidence = Column(Float, nullable=False)
    trade_offs = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("DataRoom")
