// Personal ids identify people the way a birth number (Czech rodné
// číslo) does: issued once, unique for life, never changing when the
// name does. In reality the state issues them; this course has no state
// actor, so the id is issued at a person's first contact with a bank —
// random, in the familiar ######/#### shape (the digits carry no
// meaning here).

import { randomInt } from 'node:crypto';

export function randomPersonalId(): string {
  const head = String(randomInt(0, 10 ** 6)).padStart(6, '0');
  const tail = String(randomInt(0, 10 ** 4)).padStart(4, '0');
  return `${head}/${tail}`;
}
