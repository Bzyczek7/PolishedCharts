# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.base_class import Base  # noqa
from app.models.user import User  # noqa
from app.models.symbol import Symbol  # noqa
from app.models.candle import Candle  # noqa
from app.models.alert import Alert  # noqa
from app.models.backfill_job import BackfillJob  # noqa
