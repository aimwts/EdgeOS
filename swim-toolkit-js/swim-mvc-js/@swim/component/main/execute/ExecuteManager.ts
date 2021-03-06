// Copyright 2015-2020 Swim inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {ComponentContext} from "../ComponentContext";
import {ComponentFlags, Component} from "../Component";
import {ComponentManager} from "../manager/ComponentManager";
import {ExecuteContext} from "./ExecuteContext";
import {ExecuteManagerObserver} from "./ExecuteManagerObserver";

export class ExecuteManager<C extends Component = Component> extends ComponentManager<C> {
  /** @hidden */
  readonly _componentContext: ExecuteContext;
  /** @hidden */
  _rootFlags: ComponentFlags;
  /** @hidden */
  _compileTimer: number;
  /** @hidden */
  _executeTimer: number;
  /** @hidden */
  _updateDelay: number;

  constructor() {
    super();
    this.runCompilePass = this.runCompilePass.bind(this);
    this.runExecutePass = this.runExecutePass.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);

    this._componentContext = this.initComponentContext();
    this._rootFlags = 0;
    this._compileTimer = 0;
    this._executeTimer = 0;
    this._updateDelay = ExecuteManager.MinUpdateDelay;
  }

  protected initComponentContext(): ExecuteContext {
    return {
      updateTime: 0,
    };
  }

  get componentContext(): ComponentContext {
    return this._componentContext;
  }

  get powerFlags(): ComponentFlags {
    return 0;
  }

  protected onPower(): void {
    this.powerRootComponents();
  }

  protected powerRootComponents(): void {
    const rootComponents = this._rootComponents;
    for (let i = 0, n = rootComponents.length; i < n; i += 1) {
      const rootComponent = rootComponents[i];
      if (!rootComponent.isPowered()) {
        this.powerRootComponent(rootComponent);
      }
    }
  }

  protected powerRootComponent(rootComponent: C): void {
    rootComponent.cascadePower();
    rootComponent.requireUpdate(this.powerFlags);
  }

  protected onUnpower(): void {
    this.cancelUpdate();
    this._updateDelay = ExecuteManager.MinUpdateDelay;
    this.unpowerRootComponents();
  }

  protected unpowerRootComponents(): void {
    const rootComponents = this._rootComponents;
    for (let i = 0, n = rootComponents.length; i < n; i += 1) {
      const rootComponent = rootComponents[i];
      if (rootComponent.isPowered()) {
        this.unpowerRootComponent(rootComponent);
      }
    }
  }

  protected unpowerRootComponent(rootComponent: C): void {
    rootComponent.cascadeUnpower();
  }

  get rootFlags(): ComponentFlags {
    return this._rootFlags;
  }

  requestUpdate(targetComponent: Component, updateFlags: ComponentFlags, immediate: boolean): void {
    updateFlags = this.willRequestUpdate(targetComponent, updateFlags, immediate) & Component.UpdateMask;
    this._rootFlags |= updateFlags;
    if ((this._rootFlags & Component.UpdateMask) !== 0) {
      if (immediate && this._updateDelay <= ExecuteManager.MaxCompileInterval
          && (this._rootFlags & (Component.TraversingFlag | Component.ImmediateFlag)) === 0) {
        this.runImmediatePass();
      } else {
        this.scheduleUpdate();
      }
    }
    this.didRequestUpdate(targetComponent, updateFlags, immediate);
  }

  protected willRequestUpdate(targetComponent: Component, updateFlags: ComponentFlags, immediate: boolean): ComponentFlags {
    return updateFlags | this.modifyUpdate(targetComponent, updateFlags);
  }

  protected didRequestUpdate(targetComponent: Component, updateFlags: ComponentFlags, immediate: boolean): void {
    // hook
  }

  protected modifyUpdate(targetComponent: Component, updateFlags: ComponentFlags): ComponentFlags {
    let additionalFlags = 0;
    if ((updateFlags & Component.CompileMask) !== 0) {
      additionalFlags |= Component.NeedsCompile;
    }
    if ((updateFlags & Component.ExecuteMask) !== 0) {
      additionalFlags |= Component.NeedsExecute;
    }
    return additionalFlags;
  }

  protected scheduleUpdate(): void {
    const updateFlags = this._rootFlags;
    if (this._compileTimer === 0 && this._executeTimer === 0
        && (updateFlags & Component.UpdatingMask) === 0
        && (updateFlags & Component.UpdateMask) !== 0) {
      this._compileTimer = setTimeout(this.runCompilePass, this._updateDelay) as any;
    }
  }

  protected cancelUpdate(): void {
    if (this._compileTimer !== 0) {
      clearTimeout(this._compileTimer);
      this._compileTimer = 0;
    }
    if (this._executeTimer !== 0) {
      clearTimeout(this._executeTimer);
      this._executeTimer = 0;
    }
  }

  protected runImmediatePass(): void {
    this._rootFlags |= Component.ImmediateFlag;
    try {
      if ((this._rootFlags & Component.CompileMask) !== 0) {
        this.cancelUpdate();
        this.runCompilePass(true);
      }
      if ((this._rootFlags & Component.ExecuteMask) !== 0
          && this._updateDelay <= ExecuteManager.MaxCompileInterval) {
        this.cancelUpdate();
        this.runExecutePass(true);
      }
    } finally {
      this._rootFlags &= ~Component.ImmediateFlag;
    }
  }

  protected runCompilePass(immediate: boolean = false): void {
    const rootComponents = this._rootComponents;
    this._rootFlags |= Component.TraversingFlag | Component.CompilingFlag;
    this._rootFlags &= ~Component.CompileMask;
    try {
      const t0 = performance.now();
      for (let i = 0; i < rootComponents.length; i += 1) {
        const rootComponent = rootComponents[i];
        if ((rootComponent.componentFlags & Component.CompileMask) !== 0) {
          const componentContext = rootComponent.componentContext as ExecuteContext;
          componentContext.updateTime = t0;
          rootComponent.cascadeCompile(0, componentContext);
        }
      }

      const t1 = performance.now();
      let compileDelay = Math.max(ExecuteManager.MinCompileInterval, this._updateDelay);
      if (t1 - t0 > compileDelay) {
        this._updateDelay = Math.min(Math.max(2, this._updateDelay * 2), ExecuteManager.MaxUpdateDelay);
      } else {
        this._updateDelay = Math.min(ExecuteManager.MinUpdateDelay, this._updateDelay / 2);
      }

      this.cancelUpdate();
      if ((this._rootFlags & Component.ExecuteMask) !== 0) {
        this._executeTimer = setTimeout(this.runExecutePass, ExecuteManager.MinExecuteInterval) as any;
      } else if ((this._rootFlags & Component.CompileMask) !== 0) {
        if (immediate) {
          compileDelay = Math.max(ExecuteManager.MaxCompileInterval, compileDelay);
        }
        this._compileTimer = setTimeout(this.runCompilePass, compileDelay) as any;
      }
    } finally {
      this._rootFlags &= ~(Component.TraversingFlag | Component.CompilingFlag);
    }
  }

  protected runExecutePass(immediate: boolean = false): void {
    const rootComponents = this._rootComponents;
    this._rootFlags |= Component.TraversingFlag | Component.ExecutingFlag;
    this._rootFlags &= ~Component.ExecuteMask;
    try {
      const time = performance.now();
      for (let i = 0; i < rootComponents.length; i += 1) {
        const rootComponent = rootComponents[i];
        if ((rootComponent.componentFlags & Component.ExecuteMask) !== 0) {
          const componentContext = rootComponent.componentContext as ExecuteContext;
          componentContext.updateTime = time;
          rootComponent.cascadeExecute(0, componentContext);
        }
      }

      this.cancelUpdate();
      if ((this._rootFlags & Component.CompileMask) !== 0) {
        let compileDelay = this._updateDelay;
        if (immediate) {
          compileDelay = Math.max(ExecuteManager.MaxCompileInterval, compileDelay);
        }
        this._compileTimer = setTimeout(this.runCompilePass, compileDelay) as any;
      } else if ((this._rootFlags & Component.ExecuteMask) !== 0) {
        this._executeTimer = setTimeout(this.runExecutePass, ExecuteManager.MaxExecuteInterval) as any;
      }
    } finally {
      this._rootFlags &= ~(Component.TraversingFlag | Component.ExecutingFlag);
    }
  }

  // @ts-ignore
  declare readonly componentManagerObservers: ReadonlyArray<ExecuteManagerObserver>;

  protected onAttach(): void {
    super.onAttach();
    this.attachEvents();
  }

  protected onDetach(): void {
    this.detachEvents();
    super.onDetach();
  }

  protected attachEvents(): void {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    }
  }

  protected detachEvents(): void {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
    }
  }

  protected onInsertRootComponent(rootComponent: C): void {
    super.onInsertRootComponent(rootComponent);
    this.requestUpdate(rootComponent, rootComponent.componentFlags & Component.UpdateMask, false);
  }

  /** @hidden */
  protected onVisibilityChange(): void {
    if (document.visibilityState === "visible") {
      this.onPower();
    } else {
      this.onUnpower();
    }
  }

  private static _global?: ExecuteManager<any>;
  static global<C extends Component>(): ExecuteManager<C> {
    if (ExecuteManager._global === void 0) {
      ExecuteManager._global = new ExecuteManager();
    }
    return ExecuteManager._global;
  }

  /** @hidden */
  static MinUpdateDelay: number = 0;
  /** @hidden */
  static MaxUpdateDelay: number = 167;
  /** @hidden */
  static MinCompileInterval: number = 12;
  /** @hidden */
  static MaxCompileInterval: number = 33;
  /** @hidden */
  static MinExecuteInterval: number = 4;
  /** @hidden */
  static MaxExecuteInterval: number = 16;
}
ComponentManager.Execute = ExecuteManager;
