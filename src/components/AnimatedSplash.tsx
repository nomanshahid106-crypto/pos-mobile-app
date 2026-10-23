import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

const logo = require('../../assets/icon.png') as number;
const NAVY = '#0A2540';
const MIN_MS = 1500; // keep the brand moment short and snappy
const MAX_MS = 3200; // never trap the user on the splash

/**
 * In-app animated splash shown over the app while the session loads.
 * The native splash (app.json) uses the same navy background, so the
 * handoff is seamless: logo zooms/fades in, the wordmark slides up,
 * then the whole overlay fades out.
 */
export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [minDone, setMinDone] = useState(false);
  const [gone, setGone] = useState(false);
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const textY = useRef(new Animated.Value(16)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
      Animated.timing(textY, { toValue: 0, duration: 550, delay: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(textOpacity, { toValue: 1, duration: 550, delay: 250, useNativeDriver: true }),
    ]);
    intro.start();
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.045, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const pulseTimer = setTimeout(() => pulseLoop.start(), 700);
    const minTimer = setTimeout(() => setMinDone(true), MIN_MS);
    const maxTimer = setTimeout(() => setMinDone(true), MAX_MS);
    return () => { intro.stop(); pulseLoop.stop(); clearTimeout(pulseTimer); clearTimeout(minTimer); clearTimeout(maxTimer); };
  }, [logoOpacity, logoScale, textY, textOpacity, pulse]);

  useEffect(() => {
    if (gone || !ready || !minDone) return;
    Animated.timing(overlayOpacity, { toValue: 0, duration: 380, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => { setGone(true); onDone(); });
  }, [gone, ready, minDone, overlayOpacity, onDone]);

  if (gone) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', opacity: overlayOpacity, zIndex: 50 }]} pointerEvents={gone ? 'none' : 'auto'}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: Animated.multiply(logoScale, pulse) }] }}>
        <Image source={logo} style={{ width: 132, height: 132, borderRadius: 30 }} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }], alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: 0.4, marginTop: 20 }}>Counterly</Text>
        <Text style={{ color: '#9CC8E8', fontSize: 13.5, marginTop: 6 }}>Point of Sale, made simple</Text>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 46, flexDirection: 'row' }}>
        {[0, 1, 2].map((i) => <PulsingDot key={i} delay={i * 180} />)}
      </View>
    </Animated.View>
  );
}

function PulsingDot({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.3, duration: 420, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF', marginHorizontal: 4, opacity: v }} />;
}
