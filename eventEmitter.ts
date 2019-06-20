/**
 * To remove dependency on Node.js standard library (and Node itself)
 * here is a minimal polyfill for the core `.on` and `.emit` methods in
 * the events.EventEmitter class.
 */
export class EventEmitter {
  private readonly events: Map<string, Array<(...args: any[]) => any>> = new Map();

  private _ensureExists(e: string): void {
    if (this.events.get(e) === undefined) {
      this.events.set(e, []);
    }
  }

  public emit(e: string, ...args: any[]): void {
    this._ensureExists(e);
    for (const f of (<Array<(...args: any[]) => any>>this.events.get(e))) {
      f(...args);
    }
  }

  public on(e: string, f: (...args: any[]) => any): void {
    this._ensureExists(e);
    (<Array<(...args: any[]) => any>>this.events.get(e)).push(f);
  }
}
