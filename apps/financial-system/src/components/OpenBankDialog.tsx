import { Building2 } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api.ts';
import { Field, INPUT_CLASS } from './Field.tsx';
import { OperationDialog } from './OperationDialog.tsx';

export function OpenBankDialog({
  onOpened,
}: {
  /** Lets the screen switch its identity to the freshly opened bank. */
  onOpened?: (bank: { id: number; legalName: string }) => void;
}) {
  const [legalName, setLegalName] = useState('');

  return (
    <OperationDialog
      trigger={
        <>
          <Building2 size={16} /> License a new commercial bank
        </>
      }
      title="License a new commercial bank"
      description="Registers the bank and opens its reserve account at the central bank."
      runLabel="Open"
      onRun={async () => {
        const bank = await api.banks.open.mutate({ legalName });
        setLegalName('');
        onOpened?.(bank);
        return `${bank.legalName} is registered — reserve account opened at the central bank.`;
      }}
    >
      <Field label="legal name">
        <input
          className={INPUT_CLASS}
          value={legalName}
          onChange={event => setLegalName(event.target.value)}
          placeholder="First Bank"
        />
      </Field>
    </OperationDialog>
  );
}
