"""
Pan-India Cloudburst Early Warning & Prediction System
Unified Entry Point CLI for Live Nowcasting, Advance 6-Hour Outlook, and Validation Auditing.
"""

import os
import sys
import argparse

# Add package root to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def print_banner():
    print("""
================================================================================
   🏔️  PAN-INDIA CLOUDBURST EARLY WARNING & RISK PREDICTION SYSTEM
   Physics-Informed Dual-Engine Ensemble (LightGBM + XGBoost) & Satellite Vision
================================================================================
    """)

def main():
    parser = argparse.ArgumentParser(
        description="Pan-India Cloudburst Early Warning & Prediction System CLI",
        formatter_class=argparse.RawTextHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # 1. Nowcast Command
    nowcast_parser = subparsers.add_parser("nowcast", help="Run live real-time nowcast on coordinates or named station")
    nowcast_parser.add_argument("--lat", type=float, default=30.7346, help="Latitude (Default: 30.7346 for Kedarnath)")
    nowcast_parser.add_argument("--lon", type=float, default=79.0669, help="Longitude (Default: 79.0669 for Kedarnath)")
    nowcast_parser.add_argument("--name", type=str, default="Target Location", help="Station/Valley Name")
    nowcast_parser.add_argument("--json", action="store_true", help="Output pure JSON for API / Web integration")
    
    # 2. Scan Command
    scan_parser = subparsers.add_parser("scan", help="Run live real-time network scan across 10 vulnerable Pan-India stations")
    scan_parser.add_argument("--json", action="store_true", help="Output pure JSON")
    
    # 3. Advance Outlook Command
    advance_parser = subparsers.add_parser("advance", help="Run 3 to 6-hour advance convective outlook & tendency analysis")
    advance_parser.add_argument("--lat", type=float, default=30.7346, help="Latitude")
    advance_parser.add_argument("--lon", type=float, default=79.0669, help="Longitude")
    advance_parser.add_argument("--name", type=str, default="Kedarnath Valley", help="Location Name")
    
    # 4. Test Command
    subparsers.add_parser("test", help="Execute the operational validation test suite on historical disasters")
    
    # 5. Audit Command
    subparsers.add_parser("audit", help="Run the full 7-battery enterprise ML quality & adversarial stress audit")
    
    # 6. Retrain Command
    subparsers.add_parser("train", help="Retrain the dual-engine physics ensemble on the master dataset")

    args = parser.parse_args()
    
    if args.command is None:
        print_banner()
        parser.print_help()
        print("\nQuick Examples:")
        print("  python main.py nowcast --lat 30.7346 --lon 79.0669 --name 'Kedarnath'")
        print("  python main.py scan")
        print("  python main.py advance --lat 30.7346 --lon 79.0669")
        print("  python main.py test")
        print("  python main.py audit\n")
        return

    print_banner()

    if args.command == "nowcast":
        from src.inference.live_feed_ingest import assess_live_risk, print_advisory_card, load_scorer
        import json
        artifact = load_scorer()
        res = assess_live_risk(args.lat, args.lon, args.name, artifact)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print_advisory_card(res)

    elif args.command == "scan":
        from src.inference.live_feed_ingest import assess_live_risk, print_advisory_card, load_scorer, MONITORING_NETWORK
        import json
        artifact = load_scorer()
        results = []
        for st in MONITORING_NETWORK:
            res = assess_live_risk(st["lat"], st["lon"], st["name"], artifact)
            results.append(res)
            if not args.json:
                print_advisory_card(res)
        if args.json:
            print(json.dumps(results, indent=2))

    elif args.command == "advance":
        from src.inference.live_feed_ingest import fetch_terrain_params
        from src.inference.advance_outlook_engine import evaluate_advance_outlook, print_advance_card
        terrain = fetch_terrain_params(args.lat, args.lon)
        # Fetch forward forecast sequence or simulate sample sequence
        print(f"Fetching 3-6 Hour Advance Atmospheric Trend for {args.name}...")
        from src.inference.live_feed_ingest import fetch_forward_6h_trajectory, load_scorer
        artifact = load_scorer()
        fc = fetch_forward_6h_trajectory(args.lat, args.lon, terrain, artifact)
        traj = fc.get("trajectory", [])
        if traj:
            formatted_h = []
            for h in traj:
                formatted_h.append({
                    "time_utc": h["time_utc"],
                    "temperature_c": h["temperature_c"],
                    "dew_point_c": h["dew_point_c"],
                    "surface_pressure_hpa": h["surface_pressure_hpa"],
                    "wind_speed_kmh": h["wind_speed_kmh"],
                    "rain_mm": h["rain_nowcast_mm"]
                })
            out = evaluate_advance_outlook(formatted_h, terrain)
            print_advance_card(out)
        else:
            print("Notice: Network hourly forward stream unavailable. Showing baseline physics evaluation:")
            pre_burst_sample = [
                {"time_utc": "T+1h", "temperature_c": 19.0, "dew_point_c": 15.0, "surface_pressure_hpa": 672.0, "wind_speed_kmh": 8.0, "rain_mm": 0.0},
                {"time_utc": "T+3h", "temperature_c": 20.5, "dew_point_c": 18.0, "surface_pressure_hpa": 669.5, "wind_speed_kmh": 16.0, "rain_mm": 0.5},
                {"time_utc": "T+6h", "temperature_c": 19.5, "dew_point_c": 19.5, "surface_pressure_hpa": 665.0, "wind_speed_kmh": 32.0, "rain_mm": 45.0}
            ]
            out = evaluate_advance_outlook(pre_burst_sample, terrain)
            print_advance_card(out)

    elif args.command == "test":
        from tests.test_model_validation import run_test_suite
        run_test_suite()

    elif args.command == "audit":
        from tests.enterprise_ml_audit import run_enterprise_audit
        run_enterprise_audit()

    elif args.command == "train":
        from src.training.train_model import train_and_export
        train_and_export()

if __name__ == "__main__":
    main()

