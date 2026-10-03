"""Chat with MaterialMind from the command line.

Single-turn:  python -m src.conversation.run_chat "What is the formation energy of GaAs?"
Interactive:  python -m src.conversation.run_chat
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.conversation.assistant import MaterialAssistant


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("message", nargs="?", help="One-shot chat message")
    parser.add_argument("--trace", action="store_true", help="Also print routing/engine trace JSON")
    args = parser.parse_args()

    assistant = MaterialAssistant()
    history: list[dict[str, str]] = []

    if args.message:
        result = assistant.chat(args.message)
        print(result["reply"])
        if args.trace:
            trace = {k: v for k, v in result.items() if k != "reply"}
            print("\n--- trace ---\n" + json.dumps(trace, indent=2, default=str))
        return

    print("MaterialMind chat. Type 'quit' to exit.")
    while True:
        try:
            message = input("\nyou> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if message.lower() in {"quit", "exit"} or not message:
            break
        result = assistant.chat(message, history=history)
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": result["reply"]})
        print(f"\nassistant> {result['reply']}")


if __name__ == "__main__":
    main()
