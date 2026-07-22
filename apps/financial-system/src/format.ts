// Display formatting for amounts. The API already delivers fixed-decimal
// strings in major units; this only groups the integer digits — pure
// string work, so money never passes through JS floats even for display.

export function formatMoney(amount: string): string {
  const [integer = '', fraction] = amount.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** IBANs display in groups of four, the way they are printed on cards. */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}
