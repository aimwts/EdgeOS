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

import {AnyPointR2, PointR2, BoxR2, CircleR2} from "@swim/math";
import {AnyAngle, Angle} from "@swim/angle";
import {AnyLength, Length} from "@swim/length";
import {AnyColor, Color} from "@swim/color";
import {CanvasContext, CanvasRenderer} from "@swim/render";
import {
  View,
  ViewAnimator,
  GraphicsView,
  FillViewInit,
  FillView,
  StrokeViewInit,
  StrokeView,
} from "@swim/view";
import {Arc} from "@swim/shape";
import {AnyGeoPoint, GeoPoint} from "../geo/GeoPoint";
import {GeoBox} from "../geo/GeoBox";
import {MapGraphicsViewContext} from "../graphics/MapGraphicsViewContext";
import {MapGraphicsViewInit} from "../graphics/MapGraphicsView";
import {MapGraphicsViewController} from "../graphics/MapGraphicsViewController";
import {MapGraphicsLeafView} from "../graphics/MapGraphicsLeafView";

export type AnyMapArcView = MapArcView | MapArcViewInit;

export interface MapArcViewInit extends MapGraphicsViewInit, FillViewInit, StrokeViewInit {
  geoCenter?: AnyGeoPoint;
  viewCenter?: PointR2;
  innerRadius?: AnyLength;
  outerRadius?: AnyLength;
  startAngle?: AnyAngle;
  sweepAngle?: AnyAngle;
  padAngle?: AnyAngle;
  padRadius?: AnyLength | null;
  cornerRadius?: AnyLength;
}

export class MapArcView extends MapGraphicsLeafView implements FillView, StrokeView {
  /** @hidden */
  _geoBounds: GeoBox;

  constructor() {
    super();
    this._geoBounds = GeoBox.undefined();
    this.geoCenter.onUpdate = this.onSetGeoCenter.bind(this);
  }

  get viewController(): MapGraphicsViewController<MapArcView> | null {
    return this._viewController;
  }

  @ViewAnimator(GeoPoint, {value: GeoPoint.origin()})
  geoCenter: ViewAnimator<this, GeoPoint, AnyGeoPoint>;

  @ViewAnimator(PointR2, {value: PointR2.origin()})
  viewCenter: ViewAnimator<this, PointR2, AnyPointR2>;

  @ViewAnimator(Length, {value: Length.zero()})
  innerRadius: ViewAnimator<this, Length, AnyLength>;

  @ViewAnimator(Length, {value: Length.zero()})
  outerRadius: ViewAnimator<this, Length, AnyLength>;

  @ViewAnimator(Angle, {value: Angle.zero()})
  startAngle: ViewAnimator<this, Angle, AnyAngle>;

  @ViewAnimator(Angle, {value: Angle.zero()})
  sweepAngle: ViewAnimator<this, Angle, AnyAngle>;

  @ViewAnimator(Angle, {value: Angle.zero()})
  padAngle: ViewAnimator<this, Angle, AnyAngle>;

  @ViewAnimator(Length, {value: null})
  padRadius: ViewAnimator<this, Length | null, AnyLength | null>;

  @ViewAnimator(Length, {value: Length.zero()})
  cornerRadius: ViewAnimator<this, Length, AnyLength>;

  @ViewAnimator(Color, {inherit: true})
  fill: ViewAnimator<this, Color, AnyColor>;

  @ViewAnimator(Color, {inherit: true})
  stroke: ViewAnimator<this, Color, AnyColor>;

  @ViewAnimator(Length, {inherit: true})
  strokeWidth: ViewAnimator<this, Length, AnyLength>;

  get value(): Arc {
    return new Arc(this.viewCenter.value!, this.innerRadius.value!, this.outerRadius.value!,
                   this.startAngle.value!, this.sweepAngle.value!, this.padAngle.value!,
                   this.padRadius.value!, this.cornerRadius.value!);
  }

  get state(): Arc {
    return new Arc(this.viewCenter.state!, this.innerRadius.state!, this.outerRadius.state!,
                   this.startAngle.state!, this.sweepAngle.state!, this.padAngle.state!,
                   this.padRadius.state!, this.cornerRadius.state!);
  }

  protected onSetGeoCenter(newGeoCenter: GeoPoint | undefined, oldGeoCenter: GeoPoint | undefined): void {
    if (newGeoCenter !== void 0) {
      const oldGeoBounds = this._geoBounds;
      const newGeoBounds = new GeoBox(newGeoCenter._lng, newGeoCenter._lat, newGeoCenter._lng, newGeoCenter._lat);
      this._geoBounds = newGeoBounds;
      this.didSetGeoBounds(newGeoBounds, oldGeoBounds);
    }
    this.requireUpdate(View.NeedsProject);
  }

  protected onProject(viewContext: MapGraphicsViewContext): void {
    super.onProject(viewContext);
    let viewCenter: PointR2;
    if (this.viewCenter.isAuto()) {
      const geoProjection = viewContext.geoProjection;
      viewCenter = geoProjection.project(this.geoCenter.value!);
      this.viewCenter.setAutoState(viewCenter);
    } else {
      viewCenter = this.viewCenter.value!;
    }
    const frame = this.viewFrame;
    const size = Math.min(frame.width, frame.height);
    const radius = this.outerRadius.value!.pxValue(size);
    const invalid = !isFinite(viewCenter.x) || !isFinite(viewCenter.y) || !isFinite(radius);
    const culled = invalid || !frame.intersectsCircle(new CircleR2(viewCenter.x, viewCenter.y, radius));
    this.setCulled(culled);
  }

  protected onRender(viewContext: MapGraphicsViewContext): void {
    super.onRender(viewContext);
    const renderer = viewContext.renderer;
    if (renderer instanceof CanvasRenderer && !this.isHidden() && !this.isCulled()) {
      const context = renderer.context;
      context.save();
      this.renderArc(renderer.context, this.viewFrame);
      context.restore();
    }
  }

  protected renderArc(context: CanvasContext, frame: BoxR2): void {
    const arc = this.value;
    arc.draw(context, frame);
    const fill = this.fill.value;
    if (fill !== void 0) {
      context.fillStyle = fill.toString();
      context.fill();
    }
    const stroke = this.stroke.value;
    if (stroke !== void 0) {
      const strokeWidth = this.strokeWidth.value;
      if (strokeWidth !== void 0) {
        const size = Math.min(frame.width, frame.height);
        context.lineWidth = strokeWidth.pxValue(size);
      }
      context.strokeStyle = stroke.toString();
      context.stroke();
    }
  }

  get popoverFrame(): BoxR2 {
    const frame = this.viewFrame;
    const size = Math.min(frame.width, frame.height);
    const inversePageTransform = this.pageTransform.inverse();
    const viewCenter = this.viewCenter.value!;
    const [px, py] = inversePageTransform.transform(viewCenter.x, viewCenter.y);
    const r = (this.innerRadius.value!.pxValue(size) + this.outerRadius.value!.pxValue(size)) / 2;
    const a = this.startAngle.value!.radValue() + this.sweepAngle.value!.radValue() / 2;
    const x = px + r * Math.cos(a);
    const y = py + r * Math.sin(a);
    return new BoxR2(x, y, x, y);
  }

  get viewBounds(): BoxR2 {
    const frame = this.viewFrame;
    const size = Math.min(frame.width, frame.height);
    const viewCenter = this.viewCenter.value!;
    const radius = this.outerRadius.value!.pxValue(size);
    return new BoxR2(viewCenter.x - radius, viewCenter.y - radius,
                     viewCenter.x + radius, viewCenter.y + radius);
  }

  get hitBounds(): BoxR2 {
    return this.viewBounds;
  }

  get geoBounds(): GeoBox {
    return this._geoBounds;
  }

  hitTest(x: number, y: number, viewContext: MapGraphicsViewContext): GraphicsView | null {
    let hit = super.hitTest(x, y, viewContext);
    if (hit === null) {
      const renderer = viewContext.renderer;
      if (renderer instanceof CanvasRenderer) {
        const context = renderer.context;
        context.save();
        x *= renderer.pixelRatio;
        y *= renderer.pixelRatio;
        hit = this.hitTestArc(x, y, context, this.viewFrame);
        context.restore();
      }
    }
    return hit;
  }

  protected hitTestArc(x: number, y: number, context: CanvasContext, frame: BoxR2): GraphicsView | null {
    context.beginPath();
    const arc = this.value;
    arc.draw(context, frame);
    if (this.fill.value !== void 0 && context.isPointInPath(x, y)) {
      return this;
    } else if (this.stroke.value !== void 0) {
      const strokeWidth = this.strokeWidth.value;
      if (strokeWidth !== void 0) {
        const size = Math.min(frame.width, frame.height);
        context.lineWidth = strokeWidth.pxValue(size);
        if (context.isPointInStroke(x, y)) {
          return this;
        }
      }
    }
    return null;
  }

  static fromAny(arc: AnyMapArcView): MapArcView {
    if (arc instanceof MapArcView) {
      return arc;
    } else if (typeof arc === "object" && arc !== null) {
      return MapArcView.fromInit(arc);
    }
    throw new TypeError("" + arc);
  }

  static fromInit(init: MapArcViewInit): MapArcView {
    const view = new MapArcView();
    if (init.geoCenter !== void 0) {
      view.geoCenter(init.geoCenter);
    }
    if (init.viewCenter !== void 0) {
      view.viewCenter(init.viewCenter);
    }
    if (init.innerRadius !== void 0) {
      view.innerRadius(init.innerRadius);
    }
    if (init.outerRadius !== void 0) {
      view.outerRadius(init.outerRadius);
    }
    if (init.startAngle !== void 0) {
      view.startAngle(init.startAngle);
    }
    if (init.sweepAngle !== void 0) {
      view.sweepAngle(init.sweepAngle);
    }
    if (init.padAngle !== void 0) {
      view.padAngle(init.padAngle);
    }
    if (init.padRadius !== void 0) {
      view.padRadius(init.padRadius);
    }
    if (init.cornerRadius !== void 0) {
      view.cornerRadius(init.cornerRadius);
    }
    if (init.fill !== void 0) {
      view.fill(init.fill);
    }
    if (init.stroke !== void 0) {
      view.stroke(init.stroke);
    }
    if (init.strokeWidth !== void 0) {
      view.strokeWidth(init.strokeWidth);
    }
    if (init.hidden !== void 0) {
      view.setHidden(init.hidden);
    }
    if (init.culled !== void 0) {
      view.setCulled(init.culled);
    }
    return view;
  }
}
