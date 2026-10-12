'use strict';
const PATHS = require('./flying-paths');
const ORDER = ['R', 'Y', 'B', 'G'];
class Flying {
  constructor(count = 4, random = Math.random) {
    this.colors = count === 2 ? ['R', 'B'] : ORDER.slice(0, Math.max(2, Math.min(4, count)));
    this.pieces = this.colors.map(() => [-1, -1, -1, -1]);
    this.turn = 0; this.phase = 'roll'; this.die = 0; this.random = random; this.winner = null;
  }
  legal() {
    if (this.phase !== 'choose') return [];
    return this.pieces[this.turn].map((p, i) => p === -1 ? ([2,4,6].includes(this.die) ? i : -1) : p < 57 && p + this.die <= 57 ? i : -1).filter(i => i >= 0);
  }
  roll() {
    if (this.phase !== 'roll') return false;
    this.die = 1 + Math.floor(Math.max(0, Math.min(.999999, this.random())) * 6);
    this.phase = 'choose';
    return this.die;
  }
  pass() { if (this.phase !== 'choose' || this.legal().length) return false; this.next(); return true; }
  next() { if (this.die !== 6) this.turn = (this.turn + 1) % this.colors.length; this.phase = 'roll'; }
  ringIndex(player, progress) { return (PATHS.colors[this.colors[player]].startIndex + progress) % 52; }
  position(player, piece) {
    const p = this.pieces[player][piece], route = PATHS.colors[this.colors[player]];
    return p < 0 ? route.airport[piece] : p < 52 ? PATHS.ring[this.ringIndex(player, p)] : route.home[p - 52];
  }
  move(piece) {
    if (!this.legal().includes(piece)) return false;
    const player = this.turn, from = this.pieces[player][piece];
    const to = from < 0 ? 0 : from + this.die;
    this.pieces[player][piece] = to;
    if (to < 52) for (let other=0; other<this.colors.length; other++) {
      if (other === player) continue;
      this.pieces[other] = this.pieces[other].map(p => p >= 0 && p < 52 && this.ringIndex(other,p) === this.ringIndex(player,to) ? -1 : p);
    }
    if (this.pieces[player].every(p => p === 57)) { this.winner = player; this.phase = 'done'; }
    else this.next();
    return { player, piece, from, to };
  }
}
module.exports = { Flying };
