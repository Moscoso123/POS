import json
import sys
from typing import Any


def _pick_highest(categories: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not categories:
        return None
    return max(categories, key=lambda x: (float(x.get("quantity", 0)), float(x.get("revenue", 0))))


def _pick_lowest(categories: list[dict[str, Any]]) -> dict[str, Any] | None:
    non_zero = [c for c in categories if float(c.get("quantity", 0)) > 0]
    target = non_zero if non_zero else categories
    if not target:
        return None
    return min(target, key=lambda x: (float(x.get("quantity", 0)), float(x.get("revenue", 0))))


def _build_answer(query: str, highest: dict[str, Any] | None, lowest: dict[str, Any] | None, reached_limit: list[dict[str, Any]]) -> str:
    q = (query or "").lower()

    highest_text = (
        f"Highest category is {highest.get('category', 'Unknown')} with {int(float(highest.get('quantity', 0)))} unit(s) sold"
        if highest
        else "No highest category yet"
    )
    lowest_text = (
        f"lowest category is {lowest.get('category', 'Unknown')} with {int(float(lowest.get('quantity', 0)))} unit(s) sold"
        if lowest
        else "no lowest category yet"
    )

    if reached_limit:
        names = ", ".join([item.get("name", "Unknown") for item in reached_limit])
        limit_text = f"products at limit: {names}"
    else:
        limit_text = "no products reached stock limit"

    if "lowest" in q and "category" in q:
        return f"{lowest_text}; {limit_text}."

    if "highest" in q and "category" in q:
        return f"{highest_text}; {limit_text}."

    return f"{highest_text}, {lowest_text}, and {limit_text}."


def main() -> None:
    raw = sys.stdin.read().strip()
    payload = json.loads(raw) if raw else {}

    categories = payload.get("categories", []) or []
    products = payload.get("products", []) or []
    query = payload.get("query", "") or ""

    highest = _pick_highest(categories)
    lowest = _pick_lowest(categories)

    reached_limit = [
        {
            "name": p.get("name"),
            "category": p.get("category"),
            "stock": int(float(p.get("stock", 0))),
            "minStock": int(float(p.get("minStock", 0))),
        }
        for p in products
        if float(p.get("stock", 0)) <= float(p.get("minStock", 0))
    ]

    result = {
        "highestCategory": highest,
        "lowestCategory": lowest,
        "productsReachedLimit": reached_limit,
        "answer": _build_answer(query, highest, lowest, reached_limit),
    }

    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
