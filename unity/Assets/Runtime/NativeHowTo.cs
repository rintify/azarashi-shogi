using System;
using System.Linq;

namespace Azarashi.UnityView
{
    // The illustrated movement cards use the real engine on a separate example
    // position. They never change the player's match or duplicate movement rules.
    public static class NativeHowTo
    {
        public static Cell[] Destinations(NativeEngine engine, int version, string kind, bool promoted)
        {
            var piece = new PieceState { id = "howto", kind = kind, promoted = promoted, owner = "south", at = new Cell(4, 4) };
            var pieces = new[] {
                piece,
                new PieceState { id = "howto-south", kind = "walrus", owner = "south", at = new Cell(0, 8) },
                new PieceState { id = "howto-north", kind = "walrus", owner = "north", at = new Cell(8, 0) }
            };
            if (kind == "walrus") pieces = new[] { piece, pieces[2] };
            var position = new Position { rulesVersion = version, phase = "playing", turn = "south", pieces = pieces, stocks = new Stocks { south = new Stock(), north = new Stock() } };
            var inspected = engine.Inspect(position);
            if (!string.IsNullOrEmpty(inspected.error)) throw new InvalidOperationException(inspected.error);
            return inspected.moves.Where(p => p.action.pieceId == piece.id)
                .Select(p => p.action.to).GroupBy(c => c.x + ":" + c.y).Select(g => g.First()).ToArray();
        }
        public static int SwipePage(int page, int count, float dx, float dy, float duration, float width)
        {
            if (Math.Abs(dx) <= Math.Abs(dy)) return page;
            var far = Math.Abs(dx) >= Math.Min(64, width * .18f);
            var flick = Math.Abs(dx) >= 22 && duration > 0 && Math.Abs(dx) / duration > 420;
            return far || flick ? Math.Max(0, Math.Min(count - 1, page + (dx < 0 ? 1 : -1))) : page;
        }
    }
}
