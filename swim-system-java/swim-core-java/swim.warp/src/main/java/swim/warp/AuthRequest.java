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

package swim.warp;

import swim.structure.Form;
import swim.structure.Kind;
import swim.structure.Value;

public final class AuthRequest extends HostAddressed {

  @Kind
  public static final Form<AuthRequest> FORM = new AuthRequestForm();

  public AuthRequest(Value body) {
    super(body);
  }

  public AuthRequest() {
    this(Value.absent());
  }

  @Override
  public String tag() {
    return "auth";
  }

  @Override
  public Form<AuthRequest> form() {
    return FORM;
  }

  @Override
  public AuthRequest body(Value body) {
    return new AuthRequest(body);
  }

}

final class AuthRequestForm extends HostAddressedForm<AuthRequest> {

  @Override
  public String tag() {
    return "auth";
  }

  @Override
  public Class<?> type() {
    return AuthRequest.class;
  }

  @Override
  public AuthRequest from(Value body) {
    return new AuthRequest(body);
  }

}
