from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Symbol(Base):
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, index=True)

    # Relationship to Alert (for accessing alerts)
    alerts = relationship("Alert", back_populates="symbol_obj")
