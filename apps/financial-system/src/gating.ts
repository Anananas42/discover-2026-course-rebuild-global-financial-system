// What the workbench shows follows what the financial system can do: an
// operation's button appears once its task's stub is replaced (the config
// query carries the task map), and a persona tab appears once any of its
// operations exist. The Central Bank is the exception and the landing
// tab: the institution exists from the moment the system is initialized,
// so its page is always there — balance sheet first, operations appearing task
// by task. The tool surfaces — Database and Log — are always available
// too, truthful even about an empty world, but they are raw views, never
// the landing.

import { TASK } from '@banks/shared/curriculum.ts';

import { TAB_IDS, type TabId } from './components/TabBar.tsx';

export type TaskStatusMap = Record<string, boolean>;

/** The tasks whose operations live on each gated persona tab. */
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
};

export function isDone(tasks: TaskStatusMap, taskId: string): boolean {
  return tasks[taskId] === true;
}

export function anyDone(tasks: TaskStatusMap, taskIds: string[]): boolean {
  return taskIds.some(id => isDone(tasks, id));
}

/** The tabs the workbench shows, in display order. */
export function visibleTabs(tasks: TaskStatusMap): TabId[] {
  return TAB_IDS.filter(tab => {
    const gate = TAB_TASKS[tab];
    return gate === undefined || anyDone(tasks, gate);
  });
}
