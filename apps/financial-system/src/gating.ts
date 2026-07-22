// What the workbench shows follows what the financial system can do: an
// operation's button appears once its task's stub is replaced (the config
// query carries the task map), and a persona tab appears once any of its
// operations exist. The tool surfaces — Database and Log — are always
// there: they are truthful even about an empty world. Until then the
// guide, not the workbench, is where the next step is explained.

import { TASK } from '@banks/shared/curriculum.ts';

import type { TabId } from './components/TabBar.tsx';

export type TaskStatusMap = Record<string, boolean>;

/** The tasks whose operations live on each persona tab. */
const TAB_TASKS: Partial<Record<TabId, string[]>> = {
  'central-bank': [
    TASK.lendToBank,
    TASK.writeOffBankDebt,
    TASK.transferReserves,
    TASK.payBank,
  ],
  'commercial-bank': [
    TASK.openBank,
    TASK.receiveRepayment,
    TASK.receivePayment,
    TASK.payFromBank,
    TASK.lendToClient,
    TASK.writeOffLoan,
  ],
  user: [
    TASK.becomeClient,
    TASK.openAccount,
    TASK.renamePerson,
    TASK.sendMoney,
    TASK.repayLoan,
  ],
};

export function isDone(tasks: TaskStatusMap, taskId: string): boolean {
  return tasks[taskId] === true;
}

export function anyDone(tasks: TaskStatusMap, taskIds: string[]): boolean {
  return taskIds.some(id => isDone(tasks, id));
}

/** The tabs the workbench shows, in display order. */
export function visibleTabs(tasks: TaskStatusMap): TabId[] {
  const all: TabId[] = [
    'central-bank',
    'commercial-bank',
    'user',
    'database',
    'log',
  ];
  return all.filter(tab => {
    const gate = TAB_TASKS[tab];
    return gate === undefined || anyDone(tasks, gate);
  });
}
