// The parts of the 'vscode' module that code under test touches (aliased in test/run.mjs).
export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  readonly event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => (this.listeners = this.listeners.filter((l) => l !== listener)) };
  };
  fire(e: T): void {
    for (const l of this.listeners) l(e);
  }
  dispose(): void {
    this.listeners = [];
  }
}
export const window = { createOutputChannel: () => ({ info() {}, error() {}, dispose() {} }) };
