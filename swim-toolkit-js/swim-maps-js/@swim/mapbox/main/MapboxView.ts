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

import * as mapboxgl from "mapbox-gl";
import {AnyPointR2, PointR2} from "@swim/math";
import {ViewFlags, View, GraphicsViewContext, GraphicsView, CanvasView} from "@swim/view";
import {AnyGeoPoint, GeoPoint, GeoBox, MapGraphicsViewContext, MapGraphicsNodeView} from "@swim/map";
import {MapboxProjection} from "./MapboxProjection";
import {MapboxViewObserver} from "./MapboxViewObserver";
import {MapboxViewController} from "./MapboxViewController";

export class MapboxView extends MapGraphicsNodeView {
  /** @hidden */
  readonly _map: mapboxgl.Map;
  /** @hidden */
  _geoProjection: MapboxProjection;
  /** @hidden */
  _mapZoom: number;
  /** @hidden */
  _mapHeading: number;
  /** @hidden */
  _mapTilt: number;

  constructor(map: mapboxgl.Map) {
    super();
    this.onMapRender = this.onMapRender.bind(this);
    this._map = map;
    this._geoProjection = new MapboxProjection(this._map);
    this._mapZoom = map.getZoom();
    this._mapHeading = map.getBearing();
    this._mapTilt = map.getPitch();
    this.initMap(this._map);
  }

  get map(): mapboxgl.Map {
    return this._map;
  }

  protected initMap(map: mapboxgl.Map): void {
    map.on("render", this.onMapRender);
  }

  get viewController(): MapboxViewController | null {
    return this._viewController;
  }

  project(lnglat: AnyGeoPoint): PointR2;
  project(lng: number, lat: number): PointR2;
  project(lng: AnyGeoPoint | number, lat?: number): PointR2 {
    return this._geoProjection.project.apply(this._geoProjection, arguments);
  }

  unproject(point: AnyPointR2): GeoPoint;
  unproject(x: number, y: number): GeoPoint;
  unproject(x: AnyPointR2 | number, y?: number): GeoPoint {
    return this._geoProjection.unproject.apply(this._geoProjection, arguments);
  }

  get geoProjection(): MapboxProjection {
    return this._geoProjection;
  }

  setGeoProjection(geoProjection: MapboxProjection): void {
    this.willSetGeoProjection(geoProjection);
    this._geoProjection = geoProjection;
    this.onSetGeoProjection(geoProjection);
    this.didSetGeoProjection(geoProjection);
  }

  protected willSetGeoProjection(geoProjection: MapboxProjection): void {
    this.willObserve(function (viewObserver: MapboxViewObserver): void {
      if (viewObserver.viewWillSetGeoProjection !== void 0) {
        viewObserver.viewWillSetGeoProjection(geoProjection, this);
      }
    });
  }

  protected onSetGeoProjection(geoProjection: MapboxProjection): void {
    if (!this.isHidden() && !this.isCulled()) {
      this.requireUpdate(View.NeedsProject, true);
    }
  }

  protected didSetGeoProjection(geoProjection: MapboxProjection): void {
    this.didObserve(function (viewObserver: MapboxViewObserver): void {
      if (viewObserver.viewDidSetGeoProjection !== void 0) {
        viewObserver.viewDidSetGeoProjection(geoProjection, this);
      }
    });
  }

  get mapZoom(): number {
    return this._mapZoom;
  }

  setMapZoom(newMapZoom: number): void {
    const oldMapZoom = this._mapZoom;
    if (oldMapZoom !== newMapZoom) {
      this.willSetMapZoom(newMapZoom, oldMapZoom);
      this._mapZoom = newMapZoom;
      this.onSetMapZoom(newMapZoom, oldMapZoom);
      this.didSetMapZoom(newMapZoom, oldMapZoom);
    }
  }

  protected willSetMapZoom(newMapZoom: number, oldMapZoom: number): void {
    this.didObserve(function (viewObserver: MapboxViewObserver): void {
      if (viewObserver.viewWillSetMapZoom !== void 0) {
        viewObserver.viewWillSetMapZoom(newMapZoom, oldMapZoom, this);
      }
    });
  }

  protected onSetMapZoom(newZoom: number, oldZoom: number): void {
    // hook
  }

  protected didSetMapZoom(newZoom: number, oldZoom: number): void {
    this.didObserve(function (viewObserver: MapboxViewObserver): void {
      if (viewObserver.viewDidSetMapZoom !== void 0) {
        viewObserver.viewDidSetMapZoom(newZoom, oldZoom, this);
      }
    });
  }

  get mapHeading(): number {
    return this._mapHeading;
  }

  get mapTilt(): number {
    return this._mapTilt;
  }

  protected onPower(): void {
    super.onPower();
    this.requireUpdate(View.NeedsProject);
  }

  cascadeProcess(processFlags: ViewFlags, viewContext: GraphicsViewContext): void {
    viewContext = this.mapViewContext(viewContext);
    super.cascadeProcess(processFlags, viewContext);
  }

  cascadeDisplay(displayFlags: ViewFlags, viewContext: GraphicsViewContext): void {
    viewContext = this.mapViewContext(viewContext);
    super.cascadeDisplay(displayFlags, viewContext);
  }

  childViewContext(childView: View, viewContext: MapGraphicsViewContext): MapGraphicsViewContext {
    return viewContext;
  }

  mapViewContext(viewContext: GraphicsViewContext): MapGraphicsViewContext {
    const mapViewContext = Object.create(viewContext);
    mapViewContext.geoProjection = this._geoProjection;
    mapViewContext.geoFrame = this.geoFrame;
    mapViewContext.mapZoom = this._mapZoom;
    mapViewContext.mapHeading = this._mapHeading;
    mapViewContext.mapTilt = this._mapTilt;
    return mapViewContext;
  }

  get geoFrame(): GeoBox {
    const bounds = this._map.getBounds();
    return new GeoBox(bounds.getWest(), bounds.getSouth(),
                      bounds.getEast(), bounds.getNorth());
  }

  protected onMapRender(): void {
    this._mapHeading = this._map.getBearing();
    this._mapTilt = this._map.getPitch();
    this.setMapZoom(this._map.getZoom());
    this.setGeoProjection(this._geoProjection);
  }

  hitTest(x: number, y: number, viewContext: GraphicsViewContext): GraphicsView | null {
    viewContext = this.mapViewContext(viewContext);
    return super.hitTest(x, y, viewContext as MapGraphicsViewContext);
  }

  overlayCanvas(): CanvasView | null {
    if (this._parentView !== null) {
      return this.canvasView;
    } else {
      const map = this._map;
      View.fromNode(map.getContainer());
      const canvasContainer = View.fromNode(map.getCanvasContainer());
      const canvas = canvasContainer.append("canvas");
      canvas.setEventNode(canvasContainer.node);
      canvas.append(this);
      return canvas;
    }
  }
}
