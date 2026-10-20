using System;
using System.Linq;
using UnityEngine;

namespace Azarashi.UnityView
{
    // The illustrated movement cards use the real engine on a separate example
    // position. They never change the player's match or duplicate movement rules.
    public static class NativeHowTo
    {
        // Marks identify the centre of the ENTIRE destination footprint. They
        // are not top-left cells, which misrepresented the two larger animals.
        public static Vector2 Center(Cell anchor, int width, int height, int offset) =>
            new Vector2(anchor.x - offset + width * .5f, anchor.y - offset + height * .5f);

        public static Cell[] Placements(NativeEngine engine, int version)
        {
            var position = Example(version, new[] {
                new PieceState { id = "south", kind = "walrus", owner = "south", at = new Cell(4, 4) },
                new PieceState { id = "north", kind = "walrus", owner = "north", at = new Cell(8, 0) }
            });
            position.stocks.south.seal = 1;
            return engine.Inspect(position).moves.Where(p => p.action.type == "place" && p.action.kind == "seal").Select(p => p.action.at).ToArray();
        }
        public static Preview Rotation(NativeEngine engine, int version)
        {
            var position = Example(version, new[] {
                new PieceState { id = "howto", kind = "orca", owner = "south", at = new Cell(4, 5) },
                new PieceState { id = "food", kind = "seal", owner = "north", at = new Cell(4, 3) },
                new PieceState { id = "extra", kind = "penguin", owner = "north", at = new Cell(5, 3) },
                new PieceState { id = "south", kind = "walrus", owner = "south", at = new Cell(0, 8) },
                new PieceState { id = "north", kind = "walrus", owner = "north", at = new Cell(8, 0) }
            });
            return engine.Inspect(position).moves.First(p => p.action.pieceId == "howto" && p.action.to.Same(new Cell(4, 3)) &&
                p.piece.promoted && p.piece.at.Same(new Cell(4, 3)) && p.captured.Length == 2);
        }
        public static Preview Capture(NativeEngine engine, int version, bool ownKing)
        {
            var position = Example(version, new[] {
                new PieceState { id = "howto", kind = "orca", owner = "south", at = new Cell(4, 5) },
                new PieceState { id = "food", kind = ownKing ? "walrus" : "seal", owner = ownKing ? "south" : "north", at = new Cell(4, ownKing ? 2 : 3) },
                new PieceState { id = "second", kind = "penguin", owner = "north", at = new Cell(4, ownKing ? 8 : 4) },
                new PieceState { id = "south", kind = ownKing ? "seal" : "walrus", owner = "south", at = new Cell(0, 8) },
                new PieceState { id = "north", kind = "walrus", owner = "north", at = new Cell(8, 0) }
            });
            return engine.Inspect(position).moves.First(p => p.action.pieceId == "howto" && p.action.to.Same(new Cell(4, 3)) && p.action.transformation == null);
        }
        private static Position Example(int version, PieceState[] pieces) => new Position {
            rulesVersion = version, phase = "playing", turn = "south", pieces = pieces,
            stocks = new Stocks { south = new Stock(), north = new Stock() }
        };
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
