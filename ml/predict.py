"""WardZero deterioration score.

Transparent weighted heuristic. Same weights as backend/src/risk.js.
This is decision support, not a diagnosis, and it has not been clinically validated.
"""

import argparse
import json


def assess(spo2, hr, temp, systolic, base_spo2, base_hr, base_temp, weakness, breathing):
    spo2_drop = base_spo2 - spo2
    hr_rise = hr - base_hr
    spo2_pts = 0
    if spo2 < 90:
        spo2_pts = 28
    elif spo2 <= 94:
        spo2_pts = 18
    elif spo2 < 96:
        spo2_pts = 10
    if spo2_drop >= 6:
        spo2_pts += 10
    elif spo2_drop >= 2:
        spo2_pts += 6

    hr_pts = 0
    if hr >= 110:
        hr_pts = 16
    elif hr >= 100:
        hr_pts = 12
    elif hr >= 92:
        hr_pts = 8
    elif hr >= 90:
        hr_pts = 4
    if hr_rise >= 18:
        hr_pts += 8
    elif hr_rise >= 8:
        hr_pts += 5

    temp_pts = 0
    if temp >= 38.5:
        temp_pts = 14
    elif temp >= 37.6:
        temp_pts = 9
    elif temp >= 37.2:
        temp_pts = 6

    note_pts = (6 if weakness else 0) + (7 if breathing else 0)
    bp_pts = 6 if systolic >= 150 or systolic < 95 else 0
    score = spo2_pts + hr_pts + temp_pts + note_pts + bp_pts
    concordant = spo2_pts >= 10 and hr_pts >= 8 and temp_pts >= 5
    if concordant:
        score += 2
    if score < 10:
        score = round(6 + (100 - spo2) * 2 + max(0, hr - 80) * 0.15)
    score = max(4, min(96, round(score)))
    level = "high" if score >= 65 else "medium" if score >= 25 else "low"
    return {
        "score": score,
        "level": level,
        "window": "No acute deterioration window" if level == "low" else "Next 24-48 hours",
        "contributions": {
            "spo2": spo2_pts,
            "heart_rate": hr_pts,
            "temperature": temp_pts,
            "caregiver_note": note_pts,
            "blood_pressure": bp_pts,
            "concordant_bonus": 2 if concordant else 0,
        },
        "disclaimer": "Decision-support only. Not a diagnosis and not clinically validated.",
        "metrics": "No held-out clinical metrics are reported for this heuristic.",
    }


def main():
    parser = argparse.ArgumentParser(description="WardZero risk heuristic")
    parser.add_argument("--spo2", type=float, required=True)
    parser.add_argument("--hr", type=float, required=True)
    parser.add_argument("--temp", type=float, required=True)
    parser.add_argument("--systolic", type=float, default=120)
    parser.add_argument("--base-spo2", type=float, default=97)
    parser.add_argument("--base-hr", type=float, default=82)
    parser.add_argument("--base-temp", type=float, default=36.8)
    parser.add_argument("--weakness", action="store_true")
    parser.add_argument("--breathing", action="store_true")
    args = parser.parse_args()
    print(json.dumps(assess(
        args.spo2, args.hr, args.temp, args.systolic,
        args.base_spo2, args.base_hr, args.base_temp,
        args.weakness, args.breathing,
    ), indent=2))


if __name__ == "__main__":
    main()
