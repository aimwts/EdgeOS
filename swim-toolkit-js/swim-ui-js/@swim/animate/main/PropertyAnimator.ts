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

import {Objects} from "@swim/util";
import {Transition} from "@swim/transition";
import {TweenFrameAnimator} from "./TweenFrameAnimator";

export class PropertyAnimator<O, K extends keyof O> extends TweenFrameAnimator<O[K]> {
  readonly target: O;
  readonly key: K;

  constructor(target: O, key: K, value: O[K] | undefined, transition: Transition<O[K]> | null = null) {
    super(value, transition);
    this.target = target;
    this.key = key;
  }

  update(newValue: O[K] | undefined, oldValue: O[K] | undefined): void {
    if (!Objects.equal(oldValue, newValue)) {
      this.willUpdate(newValue, oldValue);
      this.onUpdate(newValue, oldValue);
      this.didUpdate(newValue, oldValue);
    }
  }

  protected willUpdate(newValue: O[K] | undefined, oldValue: O[K] | undefined): void {
    // hook
  }

  protected onUpdate(newValue: O[K] | undefined, oldValue: O[K] | undefined): void {
    this.target[this.key] = newValue!;
  }

  protected didUpdate(newValue: O[K] | undefined, oldValue: O[K] | undefined): void {
    // hook
  }

  delete(): void {
    delete this.target[this.key];
  }
}
