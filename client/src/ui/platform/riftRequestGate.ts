// Опрос не имеет права «съесть» нажатие. Запись прерывает только GET, но не другую запись.
export class RiftRequestGate {
  private read: AbortController | null = null;
  private writing = false;
  beginRead(): AbortController | null {
    if (this.read?.signal.aborted) this.read = null;
    if (this.writing || this.read) return null;
    const controller = new AbortController(); this.read = controller; return controller;
  }
  acceptsRead(controller: AbortController): boolean { return this.read === controller && !controller.signal.aborted && !this.writing; }
  finishRead(controller: AbortController): void { if (this.read === controller) this.read = null; }
  beginWrite(): boolean {
    if (this.writing) return false;
    this.writing = true; this.read?.abort(); this.read = null; return true;
  }
  finishWrite(): void { this.writing = false; }
}
