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

package swim.dataflow;

import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.function.ToLongFunction;
import swim.streaming.Junction;
import swim.streaming.MapJunction;
import swim.streaming.MapSwimStream;
import swim.streaming.SwimStream;
import swim.streaming.SwimStreamContext;
import swim.streaming.persistence.ValuePersister;
import swim.streamlet.ModalFilteredMapStreamlet;

/**
 * Map stream where the entries are filtered according to a variable predicate.
 *
 * @param <K> The type of the keys.
 * @param <V> The type of the values.
 * @param <M> The type of the control stream for the predicate.
 */
final class ModalFilteredMapStream<K, V, M> extends AbstractMapStream<K, V> {

  private final MapSwimStream<K, V> in;
  private final M init;
  private final Function<M, BiPredicate<K, V>> switcher;
  private final SwimStream<M> control;
  private final boolean isTransient;

  /**
   * @param input          The input stream.
   * @param context        The stream initialization context.
   * @param initialMode    The initial mode.
   * @param modalPredicate The modal predicate.
   * @param controlStream  Stream of mode values to control the predicate.
   * @param isTransient Whether the state of this stream is stored persistently.
   */
  ModalFilteredMapStream(final MapSwimStream<K, V> input,
                         final BindingContext context,
                         final M initialMode,
                         final Function<M, BiPredicate<K, V>> modalPredicate,
                         final SwimStream<M> controlStream,
                         final boolean isTransient) {
    super(input.keyForm(), input.valueForm(), context);
    in = input;
    init = initialMode;
    switcher = modalPredicate;
    control = controlStream;
    this.isTransient = isTransient;
  }

  /**
   * @param input          The input stream.
   * @param context        The stream initialization context.
   * @param initialMode    The initial mode.
   * @param modalPredicate The modal predicate.
   * @param controlStream  Stream of mode values to control the predicate.
   * @param isTransient Whether the state of this stream is stored persistently.
   * @param ts             Timestamp assignment for the values.
   */
  ModalFilteredMapStream(final MapSwimStream<K, V> input,
                         final BindingContext context,
                         final M initialMode,
                         final Function<M, BiPredicate<K, V>> modalPredicate,
                         final SwimStream<M> controlStream,
                         final boolean isTransient,
                         final ToLongFunction<V> ts) {
    super(input.keyForm(), input.valueForm(), context, ts);
    in = input;
    init = initialMode;
    switcher = modalPredicate;
    control = controlStream;
    this.isTransient = isTransient;
  }

  @Override
  public MapSwimStream<K, V> updateTimestamps(final ToLongFunction<V> datation) {
    return new ModalFilteredMapStream<>(in, getContext(), init, switcher, control, isTransient, datation);
  }

  @Override
  public MapJunction<K, V> instantiate(final SwimStreamContext.InitContext context) {
    final MapJunction<K, V> source = context.createFor(in);
    final Junction<M> modes = context.createFor(control);
    final ModalFilteredMapStreamlet<K, V, M> streamlet;
    if (isTransient) {
      streamlet = new ModalFilteredMapStreamlet<>(init, switcher);
    } else {
      final ValuePersister<M> modePersister = context.getPersistenceProvider().forValue(
          StateTags.modeTag(id()), control.form(), init);
      streamlet = new ModalFilteredMapStreamlet<>(modePersister, switcher);
    }
    source.subscribe(streamlet.first());
    modes.subscribe(streamlet.second());
    return streamlet;
  }
}
