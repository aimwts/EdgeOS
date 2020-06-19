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

import {__extends} from "tslib";
import {AnyLength, Length} from "@swim/length";
import {Tween} from "@swim/transition";
import {View} from "../View";
import {ViewAnimatorDescriptor, ViewAnimatorConstructor, ViewAnimator} from "./ViewAnimator";

/** @hidden */
export interface LengthViewAnimator<V extends View> extends ViewAnimator<V, Length, AnyLength> {
}

/** @hidden */
export const LengthViewAnimator: ViewAnimatorConstructor<Length, AnyLength> = (function (_super: typeof ViewAnimator): ViewAnimatorConstructor<Length, AnyLength> {
  const LengthViewAnimator: ViewAnimatorConstructor<Length, AnyLength> = function <V extends View>(
      this: LengthViewAnimator<V>, view: V, animatorName: string | undefined,
      descriptor?: ViewAnimatorDescriptor<V, Length, AnyLength>): LengthViewAnimator<V> {
    let _this: LengthViewAnimator<V> = function accessor(value?: AnyLength, tween?: Tween<Length>): Length | undefined | V {
      if (arguments.length === 0) {
        return _this.value;
      } else {
        _this.setState(value, tween);
        return _this._view;
      }
    } as LengthViewAnimator<V>;
    (_this as any).__proto__ = this;
    _this = _super.call(_this, view, animatorName, descriptor) || _this;
    return _this;
  } as unknown as ViewAnimatorConstructor<Length, AnyLength>;
  __extends(LengthViewAnimator, _super);

  LengthViewAnimator.prototype.fromAny = function (this: LengthViewAnimator<View>, value: AnyLength | null): Length | null {
    return value !== null ? Length.fromAny(value) : null;
  };

  return LengthViewAnimator;
}(ViewAnimator));
ViewAnimator.Length = LengthViewAnimator;
