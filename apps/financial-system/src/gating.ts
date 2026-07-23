// What the workbench shows follows the student's progress: a task's
// operation button appears once the task before it passes its tests or
// once the student starts the task's own code (the config query
// carries the unlock map — apps/shared/unlocked-tasks.ts), and a
// gated tab appears once any of its tasks is unlocked. The Central
// Bank is the exception and the landing tab: the institution exists
// from the moment the system is initialized, so its page is always
// there — balance sheet first, operations appearing task by task. The
// tool surfaces — Database and Log — are always available too,
// truthful even about an empty world, but they are raw views, never
// the landing. The Interbank API view gates like a persona: it appears
// with the first task that puts a message on the wire.

import { TASK } from '@banks/shared/curriculum.ts';

import { TAB_IDS, type TabId } from './components/TabBar.tsx';

export type UnlockedTasks = Record<string, boolean>;

/** The tasks that bring each gated tab its content: a persona tab's
 *  operations, the wire's message traffic. */
const TAB_TASKS: Partial<Record<TabId, string[]>> = {
  'commercial-bank': [
    TASK.openBank,
    TASK.recordCentralBankNotice,
    TASK.receiveRepayment,
    TASK.receivePayment,
    TASK.payFromBank,
    TASK.lendToClient,
    TASK.writeOffLoan,
  ],
  people: [
    TASK.becomeClient,
    TASK.openAccount,
    TASK.renamePerson,
    TASK.sendMoney,
    TASK.repayLoan,
  ],
  // Each message kind enters the wire with one of these tasks; before
  // them the feed could only be empty.
  'interbank-api': [
    TASK.recordCentralBankNotice,
    TASK.receivePayment,
    TASK.interbankTransfer,
  ],
};

export function isUnlocked(tasks: UnlockedTasks, taskId: string): boolean {
  return tasks[taskId] === true;
}

export function anyUnlocked(tasks: UnlockedTasks, taskIds: string[]): boolean {
  return taskIds.some(id => isUnlocked(tasks, id));
}

/** The tabs the workbench shows, in display order. */
export function visibleTabs(tasks: UnlockedTasks): TabId[] {
  return TAB_IDS.filter(tab => {
    const gate = TAB_TASKS[tab];
    return gate === undefined || anyUnlocked(tasks, gate);
  });
}
