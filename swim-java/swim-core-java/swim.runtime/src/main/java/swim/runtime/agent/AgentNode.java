// Copyright 2015-2019 SWIM.AI inc.
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

package swim.runtime.agent;

import java.util.Iterator;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicReferenceFieldUpdater;
import swim.api.downlink.Downlink;
import swim.api.lane.CommandLane;
import swim.api.lane.DemandLane;
import swim.api.lane.DemandMapLane;
import swim.api.lane.JoinMapLane;
import swim.api.lane.JoinValueLane;
import swim.api.lane.Lane;
import swim.api.lane.LaneFactory;
import swim.api.lane.ListLane;
import swim.api.lane.MapLane;
import swim.api.lane.SpatialLane;
import swim.api.lane.SupplyLane;
import swim.api.lane.ValueLane;
import swim.api.policy.Policy;
import swim.api.ws.WsLane;
import swim.collections.HashTrieMap;
import swim.concurrent.Call;
import swim.concurrent.Cont;
import swim.concurrent.Conts;
import swim.concurrent.Schedule;
import swim.concurrent.Stage;
import swim.concurrent.Task;
import swim.concurrent.TaskContext;
import swim.concurrent.TaskFunction;
import swim.concurrent.TaskRef;
import swim.concurrent.TimerFunction;
import swim.concurrent.TimerRef;
import swim.math.R2Shape;
import swim.math.Z2Form;
import swim.runtime.AbstractTierBinding;
import swim.runtime.CellContext;
import swim.runtime.HttpBinding;
import swim.runtime.LaneBinding;
import swim.runtime.LaneContext;
import swim.runtime.LinkBinding;
import swim.runtime.NodeBinding;
import swim.runtime.NodeContext;
import swim.runtime.PushRequest;
import swim.runtime.TierContext;
import swim.runtime.lane.CommandLaneView;
import swim.runtime.lane.DemandLaneView;
import swim.runtime.lane.DemandMapLaneView;
import swim.runtime.lane.JoinMapLaneView;
import swim.runtime.lane.JoinValueLaneView;
import swim.runtime.lane.LaneView;
import swim.runtime.lane.ListLaneView;
import swim.runtime.lane.MapLaneView;
import swim.runtime.lane.SpatialLaneView;
import swim.runtime.lane.SupplyLaneView;
import swim.runtime.lane.ValueLaneView;
import swim.runtime.uplink.ErrorUplinkModem;
import swim.runtime.uplink.HttpErrorUplinkModem;
import swim.spatial.GeoProjection;
import swim.store.StoreBinding;
import swim.structure.Record;
import swim.structure.Value;
import swim.uri.Uri;

public class AgentNode extends AbstractTierBinding implements NodeBinding, CellContext, LaneFactory, Schedule, Stage, Task {
  protected NodeContext nodeContext;

  protected TaskContext taskContext;

  volatile HashTrieMap<Uri, LaneBinding> lanes;

  final ConcurrentLinkedQueue<Runnable> mailbox;

  final long createdTime;

  public AgentNode() {
    this.lanes = HashTrieMap.empty();
    this.mailbox = new ConcurrentLinkedQueue<Runnable>();
    this.createdTime = System.currentTimeMillis();
  }

  @Override
  public TierContext tierContext() {
    return this.nodeContext;
  }

  @Override
  public NodeContext nodeContext() {
    return this.nodeContext;
  }

  @Override
  public void setNodeContext(NodeContext nodeContext) {
    this.nodeContext = nodeContext;
    nodeContext.stage().task(this);
  }

  @Override
  public TaskContext taskContext() {
    return this.taskContext;
  }

  @Override
  public void setTaskContext(TaskContext taskContext) {
    this.taskContext = taskContext;
  }

  @SuppressWarnings("unchecked")
  @Override
  public <T> T unwrapNode(Class<T> nodeClass) {
    if (nodeClass.isAssignableFrom(getClass())) {
      return (T) this;
    } else {
      return null;
    }
  }

  protected LaneContext createLaneContext(LaneBinding lane, Uri laneUri) {
    return new AgentLane(this, lane, laneUri);
  }

  @Override
  public final Uri meshUri() {
    return this.nodeContext.meshUri();
  }

  @Override
  public final Value partKey() {
    return this.nodeContext.partKey();
  }

  @Override
  public final Uri hostUri() {
    return this.nodeContext.hostUri();
  }

  @Override
  public final Uri nodeUri() {
    return this.nodeContext.nodeUri();
  }

  @Override
  public Value agentKey() {
    return Value.absent();
  }

  @Override
  public long createdTime() {
    return this.createdTime;
  }

  protected static Uri normalizeLaneUri(Uri laneUri) {
    if (laneUri.query().isDefined() || laneUri.fragment().isDefined()) {
      laneUri = Uri.from(laneUri.scheme(), laneUri.authority(), laneUri.path());
    }
    return laneUri;
  }

  @Override
  public HashTrieMap<Uri, LaneBinding> getLanes() {
    return this.lanes;
  }

  @Override
  public LaneBinding getLane(Uri laneUri) {
    laneUri = normalizeLaneUri(laneUri);
    return this.lanes.get(laneUri);
  }

  public LaneBinding openLaneView(Uri laneUri, LaneView laneView) {
    laneUri = normalizeLaneUri(laneUri);
    HashTrieMap<Uri, LaneBinding> oldLanes;
    HashTrieMap<Uri, LaneBinding> newLanes;
    LaneBinding laneBinding = null;
    do {
      oldLanes = this.lanes;
      if (oldLanes.containsKey(laneUri)) {
        laneBinding = oldLanes.get(laneUri);
        newLanes = oldLanes;
        break;
      } else {
        if (laneBinding == null) {
          laneBinding = this.nodeContext.injectLane(laneUri, laneView.createLaneBinding());
          final LaneContext laneContext = createLaneContext(laneBinding, laneUri);
          laneBinding.setLaneContext(laneContext);
        }
        newLanes = oldLanes.updated(laneUri, laneBinding);
      }
    } while (oldLanes != newLanes && !LANES.compareAndSet(this, oldLanes, newLanes));
    laneBinding.openLaneView(laneView);
    if (oldLanes != newLanes) {
      activate(laneBinding);
    }
    return laneBinding;
  }

  public LaneBinding openLane(Uri laneUri, Lane lane) {
    laneUri = normalizeLaneUri(laneUri);
    return openLaneView(laneUri, (LaneView) lane);
  }

  @Override
  public LaneBinding openLane(Uri laneUri, LaneBinding lane) {
    laneUri = normalizeLaneUri(laneUri);
    HashTrieMap<Uri, LaneBinding> oldLanes;
    HashTrieMap<Uri, LaneBinding> newLanes;
    LaneBinding laneBinding = null;
    do {
      oldLanes = this.lanes;
      if (oldLanes.containsKey(laneUri)) {
        laneBinding = null;
        newLanes = oldLanes;
        break;
      } else {
        if (laneBinding == null) {
          laneBinding = this.nodeContext.injectLane(laneUri, lane);
          final LaneContext laneContext = createLaneContext(laneBinding, laneUri);
          laneBinding.setLaneContext(laneContext);
        }
        newLanes = oldLanes.updated(laneUri, laneBinding);
      }
    } while (oldLanes != newLanes && !LANES.compareAndSet(this, oldLanes, newLanes));
    if (laneBinding != null) {
      activate(laneBinding);
    }
    return laneBinding;
  }

  public void closeLane(Uri laneUri) {
    laneUri = normalizeLaneUri(laneUri);
    HashTrieMap<Uri, LaneBinding> oldLanes;
    HashTrieMap<Uri, LaneBinding> newLanes;
    LaneBinding laneBinding = null;
    do {
      oldLanes = this.lanes;
      final LaneBinding lane = oldLanes.get(laneUri);
      if (lane != null) {
        laneBinding = lane;
        newLanes = oldLanes.removed(laneUri);
      } else {
        laneBinding = null;
        newLanes = oldLanes;
        break;
      }
    } while (oldLanes != newLanes && !LANES.compareAndSet(this, oldLanes, newLanes));
    if (laneBinding != null) {
      laneBinding.didClose();
    }
  }

  @Override
  public <V> CommandLane<V> commandLane() {
    return new CommandLaneView<V>(null, null);
  }

  @Override
  public <V> DemandLane<V> demandLane() {
    return new DemandLaneView<V>(null, null);
  }

  @Override
  public <K, V> DemandMapLane<K, V> demandMapLane() {
    return new DemandMapLaneView<K, V>(null, null, null);
  }

  @Override
  public <L, K, V> JoinMapLane<L, K, V> joinMapLane() {
    return new JoinMapLaneView<L, K, V>(null, null, null, null);
  }

  @Override
  public <K, V> JoinValueLane<K, V> joinValueLane() {
    return new JoinValueLaneView<K, V>(null, null, null);
  }

  @Override
  public <V> ListLane<V> listLane() {
    return new ListLaneView<V>(null, null);
  }

  @Override
  public <K, V> MapLane<K, V> mapLane() {
    return new MapLaneView<K, V>(null, null, null);
  }

  @Override
  public <K, S, V> SpatialLane<K, S, V> spatialLane(Z2Form<S> shapeForm) {
    return new SpatialLaneView<K, S, V>(null, null, shapeForm, null);
  }

  @Override
  public <K, V> SpatialLane<K, R2Shape, V> geospatialLane() {
    return new SpatialLaneView<K, R2Shape, V>(null, null, GeoProjection.wgs84Form(), null);
  }

  @Override
  public <V> SupplyLane<V> supplyLane() {
    return new SupplyLaneView<V>(null, null);
  }

  @Override
  public <V> ValueLane<V> valueLane() {
    return new ValueLaneView<V>(null, null);
  }

  @Override
  public <I, O> WsLane<I, O> wsLane() {
    throw new UnsupportedOperationException(); // TODO
  }

  @Override
  public void openUplink(LinkBinding link) {
    final Uri laneUri = normalizeLaneUri(link.laneUri());
    final LaneBinding laneBinding = getLane(laneUri);
    if (laneBinding != null) {
      laneBinding.openUplink(link);
    } else {
      final ErrorUplinkModem linkContext = new ErrorUplinkModem(link, Record.of().attr("laneNotFound"));
      link.setLinkContext(linkContext);
      linkContext.cueDown();
    }
  }

  @Override
  public LinkBinding bindDownlink(Downlink downlink) {
    return this.nodeContext.bindDownlink(downlink);
  }

  @Override
  public void openDownlink(LinkBinding link) {
    this.nodeContext.openDownlink(link);
  }

  @Override
  public void closeDownlink(LinkBinding link) {
    // nop
  }

  @Override
  public void httpUplink(HttpBinding http) {
    final LaneBinding laneBinding = getLane(http.laneUri());
    if (laneBinding != null) {
      laneBinding.httpUplink(http);
    } else {
      final HttpErrorUplinkModem httpContext = new HttpErrorUplinkModem(http);
      http.setHttpContext(httpContext);
    }
  }

  @Override
  public void httpDownlink(HttpBinding http) {
    // TODO
  }

  @Override
  public void pushUp(PushRequest pushRequest) {
    final LaneBinding laneBinding = getLane(pushRequest.envelope().laneUri());
    if (laneBinding != null) {
      laneBinding.pushUp(pushRequest);
    } else {
      pushRequest.didDecline();
    }
  }

  @Override
  public void pushDown(PushRequest pushRequest) {
    this.nodeContext.pushDown(pushRequest);
  }

  @Override
  public void trace(Object message) {
    this.nodeContext.trace(message);
  }

  @Override
  public void debug(Object message) {
    this.nodeContext.debug(message);
  }

  @Override
  public void info(Object message) {
    this.nodeContext.info(message);
  }

  @Override
  public void warn(Object message) {
    this.nodeContext.warn(message);
  }

  @Override
  public void error(Object message) {
    this.nodeContext.error(message);
  }

  @Override
  protected void willOpen() {
    super.willOpen();
    final Iterator<LaneBinding> lanesIterator = this.lanes.valueIterator();
    while (lanesIterator.hasNext()) {
      lanesIterator.next().open();
    }
  }

  @Override
  protected void willLoad() {
    super.willLoad();
    final Iterator<LaneBinding> lanesIterator = this.lanes.valueIterator();
    while (lanesIterator.hasNext()) {
      lanesIterator.next().load();
    }
  }

  @Override
  protected void willStart() {
    super.willStart();
    final Iterator<LaneBinding> lanesIterator = this.lanes.valueIterator();
    while (lanesIterator.hasNext()) {
      lanesIterator.next().start();
    }
  }

  @Override
  protected void willStop() {
    super.willStop();
    final Iterator<LaneBinding> lanesIterator = this.lanes.valueIterator();
    while (lanesIterator.hasNext()) {
      lanesIterator.next().stop();
    }
  }

  @Override
  protected void willUnload() {
    super.willUnload();
    final Iterator<LaneBinding> lanesIterator = this.lanes.valueIterator();
    while (lanesIterator.hasNext()) {
      lanesIterator.next().unload();
    }
  }

  @Override
  protected void willClose() {
    super.willClose();
    final Iterator<LaneBinding> lanesIterator = this.lanes.valueIterator();
    while (lanesIterator.hasNext()) {
      lanesIterator.next().close();
    }
  }

  @Override
  public void didClose() {
    // nop
  }

  @Override
  public void didFail(Throwable error) {
    error.printStackTrace();
  }

  @Override
  public Policy policy() {
    return this.nodeContext.policy();
  }

  @Override
  public Schedule schedule() {
    return this;
  }

  @Override
  public Stage stage() {
    return this;
  }

  @Override
  public StoreBinding store() {
    return this.nodeContext.store();
  }

  @Override
  public TimerRef timer(TimerFunction timer) {
    final Schedule schedule = this.nodeContext.schedule();
    final AgentTimer agentTimer = new AgentTimer(this, timer);
    schedule.timer(timer);
    return agentTimer;
  }

  @Override
  public TimerRef setTimer(long millis, TimerFunction timer) {
    final Schedule schedule = this.nodeContext.schedule();
    final AgentTimer agentTimer = new AgentTimer(this, timer);
    schedule.setTimer(millis, agentTimer);
    return agentTimer;
  }

  @Override
  public TaskRef task(TaskFunction task) {
    return this.nodeContext.stage().task(task);
  }

  @Override
  public <T> Call<T> call(Cont<T> future) {
    return this.nodeContext.stage().call(future);
  }

  @Override
  public void execute(Runnable command) {
    this.mailbox.add(command);
    this.taskContext.cue();
  }

  @Override
  public boolean taskWillBlock() {
    return false;
  }

  @Override
  public void runTask() {
    do {
      final Runnable command = this.mailbox.poll();
      if (command != null) {
        try {
          command.run();
        } catch (Throwable error) {
          if (Conts.isNonFatal(error)) {
            didFail(error);
          } else {
            throw error;
          }
        }
      } else {
        break;
      }
    } while (true);
  }

  @Override
  public void taskWillCue() {
    // nop
  }

  @Override
  public void taskDidCancel() {
    // nop
  }

  @SuppressWarnings("unchecked")
  static final AtomicReferenceFieldUpdater<AgentNode, HashTrieMap<Uri, LaneBinding>> LANES =
      AtomicReferenceFieldUpdater.newUpdater(AgentNode.class, (Class<HashTrieMap<Uri, LaneBinding>>) (Class<?>) HashTrieMap.class, "lanes");

}
