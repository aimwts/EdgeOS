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

import {Transition} from "@swim/transition";
import {ViewObserver} from "@swim/view";
import {MoodVector} from "../mood/MoodVector";
import {ThemeMatrix} from "../theme/ThemeMatrix";
import {ThemedView} from "./ThemedView";

export interface ThemedViewObserver<V extends ThemedView = ThemedView> extends ViewObserver<V> {
  viewWillApplyTheme?(theme: ThemeMatrix, mood: MoodVector, transition: Transition<any> | null, view: V): void;

  viewDidApplyTheme?(theme: ThemeMatrix, mood: MoodVector, transition: Transition<any> | null, view: V): void;
}
