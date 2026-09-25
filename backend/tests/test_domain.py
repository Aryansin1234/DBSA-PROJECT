"""Unit tests for domain helper functions (no DB required)."""
from datetime import date
from types import SimpleNamespace

from app.models import LabFlag
from app.services.domain import calculate_age, flag_lab_result


def test_calculate_age_before_birthday():
    dob = date(2000, 12, 31)
    # As of any date before Dec 31 in a year, age is (year - 2000 - 1)
    assert calculate_age(dob) == date.today().year - 2000 - (
        1 if (date.today().month, date.today().day) < (12, 31) else 0
    )


def test_flag_normal():
    test = SimpleNamespace(ref_low=70, ref_high=100)
    assert flag_lab_result(test, 85) == LabFlag.NORMAL


def test_flag_low_high_critical():
    test = SimpleNamespace(ref_low=70, ref_high=100)
    assert flag_lab_result(test, 65) == LabFlag.LOW
    assert flag_lab_result(test, 120) == LabFlag.HIGH
    assert flag_lab_result(test, 200) == LabFlag.CRITICAL  # > 100 * 1.5
    assert flag_lab_result(test, 30) == LabFlag.CRITICAL   # < 70 * 0.5


def test_flag_no_reference_range():
    test = SimpleNamespace(ref_low=None, ref_high=None)
    assert flag_lab_result(test, 999) == LabFlag.NORMAL
