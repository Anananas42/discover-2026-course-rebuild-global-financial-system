// One institution's knobs, as key-value rows — the policy rate lives here.

import { Repo } from './repo.ts';

export class SettingRepo extends Repo {
  async get({ key }: { key: string }): Promise<string | undefined> {
    const row = await this.scoped()
      .selectFrom('settings')
      .selectAll()
      .where('key', '=', key)
      .executeTakeFirst();
    return row?.value;
  }

  async set({ key, value }: { key: string; value: string }): Promise<void> {
    await this.scoped()
      .insertInto('settings')
      .values({ key, value })
      .onConflict(conflict => conflict.column('key').doUpdateSet({ value }))
      .execute();
  }
}
