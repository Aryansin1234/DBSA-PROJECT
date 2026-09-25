"""Domain helper functions mirroring the SQL functions in schema.sql."""
from datetime import date

from app.models import LabFlag, LabTest


def calculate_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def flag_lab_result(test: LabTest, value: float) -> LabFlag:
    lo, hi = test.ref_low, test.ref_high
    if lo is None or hi is None:
        return LabFlag.NORMAL
    lo, hi = float(lo), float(hi)
    if value < lo * 0.5 or value > hi * 1.5:
        return LabFlag.CRITICAL
    if value < lo:
        return LabFlag.LOW
    if value > hi:
        return LabFlag.HIGH
    return LabFlag.NORMAL
