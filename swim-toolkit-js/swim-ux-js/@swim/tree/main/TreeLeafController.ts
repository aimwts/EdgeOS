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

import {Tween} from "@swim/transition";
import {PositionGestureInput} from "@swim/gesture";
import {ThemedHtmlViewController} from "@swim/theme";
import {TreeLeaf} from "./TreeLeaf";
import {TreeLeafObserver} from "./TreeLeafObserver";

export class TreeLeafController<V extends TreeLeaf = TreeLeaf> extends ThemedHtmlViewController<V> implements TreeLeafObserver<V> {
  leafDidPress(input: PositionGestureInput, event: Event | null, view: V): void {
    // hook
  }

  leafWillHighlight(tween: Tween<any>, view: V): void {
    // hook
  }

  leafDidHighlight(tween: Tween<any>, view: V): void {
    // hook
  }

  leafWillUnhighlight(tween: Tween<any>, view: V): void {
    // hook
  }

  leafDidUnhighlight(tween: Tween<any>, view: V): void {
    // hook
  }
}
