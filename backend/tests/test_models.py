from app.models.user import User
from app.models.alert import Alert
from app.models.symbol import Symbol
from app.models.candle import Candle
import pytest

def test_create_user():
    user = User(email="test@example.com", hashed_password="hashedpassword")
    assert user.email == "test@example.com"

def test_create_symbol():
    symbol = Symbol(ticker="IBM", name="International Business Machines")
    assert symbol.ticker == "IBM"

def test_create_alert():
    alert = Alert(symbol_id=1, condition="price_above", threshold=150.0)
    assert alert.condition == "price_above"

def test_create_candle():
    candle = Candle(symbol_id=1, open=100.0, high=110.0, low=90.0, close=105.0, volume=1000)
    assert candle.close == 105.0
