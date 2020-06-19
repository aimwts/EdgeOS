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

import {HtmlViewObserver} from "@swim/view";
import {ActionStack} from "./ActionStack";

export interface ActionStackObserver<V extends ActionStack = ActionStack> extends HtmlViewObserver<V> {
  actionStackWillExpand?(view: V): void;

  actionStackDidExpand?(view: V): void;

  actionStackWillCollapse?(view: V): void;

  actionStackDidCollapse?(view: V): void;

  actionStackWillShow?(view: V): void;

  actionStackDidShow?(view: V): void;

  actionStackWillHide?(view: V): void;

  actionStackDidHide?(view: V): void;
}
