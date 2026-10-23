import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, ErrorBox, Field, Screen, Sub, Title, useC } from '@/components/ui';
import { authService } from '@/services';
import { friendlyError } from '@/lib/supabase';
import { loginSchema, registerSchema, storeSchema } from '@/validation/schemas';

const SIGN_IN_ACCENT = '#0A9BD8';
const REMEMBERED_EMAIL_KEY = 'pospro.rememberedEmail';

export function LoginScreen() {
  const c = useC();
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const { control, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  useEffect(() => { AsyncStorage.getItem(REMEMBERED_EMAIL_KEY).then((email) => { if (email) setValue('email', email); }).catch(() => {}); }, [setValue]);
  const onSubmit = handleSubmit(async (v) => { setError(''); try { if (remember) { await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, v.email.trim()); } else { await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY); } await authService.signIn(v.email.trim(), v.password); } catch (e) { setError(friendlyError(e)); } });
  const fieldBg = c.input === '#FFFFFF' ? '#F1F6FB' : c.input;
  const iconColor = '#94A3B8';
  return (
    <Screen><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 40, paddingBottom: 24 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
          <MaterialCommunityIcons name="cash-register" size={34} color={SIGN_IN_ACCENT} />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '800', color: c.text, marginTop: 24 }}>Welcome</Text>
        <Text style={{ fontSize: 14.5, color: c.sub, marginTop: 8, textAlign: 'center' }}>Enter your credentials to start your shift</Text>
      </View>
      <View style={{ marginTop: 36 }}>
        {!!error && <ErrorBox message={error} />}
        <Text style={{ fontSize: 15, fontWeight: '500', color: c.text, marginBottom: 8 }}>Email</Text>
        <Controller control={control} name="email" render={({ field: { onChange, onBlur, value } }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: fieldBg, borderWidth: 1, borderColor: errors.email ? c.danger : c.border, borderRadius: 12, height: 52, paddingHorizontal: 14 }}>
            <MaterialCommunityIcons name="at" size={20} color={iconColor} />
            <TextInput style={{ flex: 1, marginLeft: 10, fontSize: 15, color: c.text }} placeholder="alex.turner@store.com" placeholderTextColor={c.sub} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={value} onChangeText={onChange} onBlur={onBlur} />
          </View>
        )} />
        {!!errors.email?.message && <Text style={{ color: c.danger, marginTop: 4, fontSize: 13 }}>{errors.email.message}</Text>}
        <Text style={{ fontSize: 15, fontWeight: '500', color: c.text, marginBottom: 8, marginTop: 20 }}>Password</Text>
        <Controller control={control} name="password" render={({ field: { onChange, onBlur, value } }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: fieldBg, borderWidth: 1, borderColor: errors.password ? c.danger : c.border, borderRadius: 12, height: 52, paddingHorizontal: 14 }}>
            <Ionicons name="lock-closed-outline" size={19} color={iconColor} />
            <TextInput style={{ flex: 1, marginLeft: 10, fontSize: 15, color: c.text }} placeholder="••••••••••••" placeholderTextColor={c.sub} secureTextEntry={!showPassword} autoComplete="password" value={value} onChangeText={onChange} onBlur={onBlur} />
            <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={iconColor} />
            </TouchableOpacity>
          </View>
        )} />
        {!!errors.password?.message && <Text style={{ color: c.danger, marginTop: 4, fontSize: 13 }}>{errors.password.message}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setRemember((r) => !r)} accessibilityRole="checkbox" accessibilityState={{ checked: remember }}>
            <View style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: remember ? SIGN_IN_ACCENT : 'transparent', borderWidth: remember ? 0 : 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
              {remember && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={{ marginLeft: 8, fontSize: 14, color: c.text }}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: SIGN_IN_ACCENT }}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onSubmit} disabled={isSubmitting} accessibilityRole="button" style={{ backgroundColor: SIGN_IN_ACCENT, opacity: isSubmitting ? 0.6 : 1, height: 54, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : (<><Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Sign In</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" style={{ marginLeft: 8 }} /></>)}
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28 }}>
          <Text style={{ fontSize: 14, color: c.sub }}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: SIGN_IN_ACCENT }}>Create an account</Text>
          </TouchableOpacity>
        </View>
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <TouchableOpacity onPress={() => Alert.alert('How to use this terminal', 'Sign in with your store email and password to start your shift. New here? Tap "Create an account", then set up your store. Forgot your password? Tap "Forgot password?" and we\'ll email you a reset link.')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: fieldBg, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Ionicons name="help-circle-outline" size={18} color={c.sub} />
            <Text style={{ marginLeft: 6, fontSize: 13, color: c.sub }}><Text style={{ fontWeight: '600', color: c.text }}>Need help?</Text> How to use this terminal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView></Screen>
  );
}

export function RegisterScreen() {
  const c = useC();
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema), defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' } });
  const onSubmit = handleSubmit(async (v) => { if (!agreed) { setError('Please agree to the Staff Compliance Policy & Terminal Security Terms to continue.'); return; } setError(''); try { const res = await authService.signUp(v.email.trim(), v.password, v.fullName.trim()) as unknown as { session?: unknown }; if (!res?.session) Alert.alert('Check your email', 'Confirm your email address, then sign in.'); } catch (e) { setError(friendlyError(e)); } });
  const fieldBg = c.input === '#FFFFFF' ? '#F1F6FB' : c.input;
  const iconColor = '#94A3B8';
  const renderField = (name: 'fullName' | 'email' | 'password' | 'confirmPassword', label: string, hint: string | undefined, icon: React.ReactNode, placeholder: string, opts: { secure?: boolean; show?: boolean; toggle?: () => void; keyboardType?: 'email-address'; autoCapitalize?: 'none' } = {}) => (
    <View key={name}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 18 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: c.text }}>{label}</Text>
        {!!hint && <Text style={{ fontSize: 12.5, color: c.sub }}>{hint}</Text>}
      </View>
      <Controller control={control} name={name} render={({ field: { onChange, onBlur, value } }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: fieldBg, borderWidth: 1, borderColor: errors[name] ? c.danger : c.border, borderRadius: 12, height: 52, paddingHorizontal: 14 }}>
          {icon}
          <TextInput style={{ flex: 1, marginLeft: 10, fontSize: 15, color: c.text }} placeholder={placeholder} placeholderTextColor={c.sub} secureTextEntry={opts.secure && !opts.show} keyboardType={opts.keyboardType} autoCapitalize={opts.autoCapitalize} value={value} onChangeText={onChange} onBlur={onBlur} />
          {opts.secure && <TouchableOpacity onPress={opts.toggle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={opts.show ? 'Hide password' : 'Show password'}><Ionicons name={opts.show ? 'eye-outline' : 'eye-off-outline'} size={20} color={iconColor} /></TouchableOpacity>}
        </View>
      )} />
      {!!errors[name]?.message && <Text style={{ color: c.danger, marginTop: 4, fontSize: 13 }}>{errors[name]?.message}</Text>}
    </View>
  );
  return (
    <Screen><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 32, paddingBottom: 24 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 60, height: 60, borderRadius: 17, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
          <Ionicons name="person-add" size={29} color={SIGN_IN_ACCENT} />
        </View>
        <Text style={{ fontSize: 26, fontWeight: '800', color: c.text, marginTop: 18 }}>Create Account</Text>
      </View>
      <View style={{ backgroundColor: c.card, borderRadius: 20, borderWidth: 1, borderColor: c.border, paddingHorizontal: 18, paddingBottom: 20, marginTop: 22 }}>
        {!!error && <ErrorBox message={error} />}
        {renderField('fullName', 'Full Name', 'Required', <Ionicons name="person-outline" size={19} color={iconColor} />, 'Alex Turner')}
        {renderField('email', 'Email', 'Terminal ID', <MaterialCommunityIcons name="at" size={20} color={iconColor} />, 'alex.turner@store.com', { keyboardType: 'email-address', autoCapitalize: 'none' })}
        {renderField('password', 'Password', undefined, <Ionicons name="lock-closed-outline" size={19} color={iconColor} />, 'Create a password', { secure: true, show: showPw, toggle: () => setShowPw((s) => !s) })}
        {renderField('confirmPassword', 'Confirm Password', undefined, <Ionicons name="shield-checkmark-outline" size={19} color={iconColor} />, 'Repeat your password', { secure: true, show: showConfirm, toggle: () => setShowConfirm((s) => !s) })}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 20 }} onPress={() => setAgreed((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
          <View style={{ width: 20, height: 20, borderRadius: 5, marginTop: 1, backgroundColor: agreed ? SIGN_IN_ACCENT : 'transparent', borderWidth: agreed ? 0 : 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            {agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <Text style={{ marginLeft: 9, fontSize: 13.5, color: c.sub, flex: 1, lineHeight: 19 }}>I agree to the <Text style={{ color: SIGN_IN_ACCENT, fontWeight: '600' }}>Staff Compliance Policy</Text> &amp; <Text style={{ color: SIGN_IN_ACCENT, fontWeight: '600' }}>Terminal Security Terms</Text></Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSubmit} disabled={isSubmitting} accessibilityRole="button" style={{ backgroundColor: SIGN_IN_ACCENT, opacity: isSubmitting ? 0.6 : 1, height: 54, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 }}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : (<><Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Create Account</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" style={{ marginLeft: 8 }} /></>)}
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 14, color: c.sub }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ fontSize: 14, fontWeight: '700', color: SIGN_IN_ACCENT }}>Sign In</Text></TouchableOpacity>
        </View>
      </View>
      <View style={{ alignItems: 'center', marginTop: 26 }}>
        <TouchableOpacity onPress={() => Alert.alert('How to use this terminal', 'Create your account with your name and store email, agree to the compliance policy, then sign in and set up your store.')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: fieldBg, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Ionicons name="help-circle-outline" size={18} color={c.sub} />
          <Text style={{ marginLeft: 6, fontSize: 13, color: c.sub }}><Text style={{ fontWeight: '600', color: c.text }}>Need help?</Text> How to use this terminal</Text>
        </TouchableOpacity>
      </View>
    </ScrollView></Screen>
  );
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState('');
  return (
    <Screen>
      <Title>Reset password</Title><Sub>We will email you a reset link.</Sub>
      {!!error && <ErrorBox message={error} />}
      <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Button title={sent ? 'Link sent — send again' : 'Send reset link'} onPress={async () => { try { await authService.resetPassword(email.trim()); setSent(true); } catch (e) { setError(friendlyError(e)); } }} />
      <Button title="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

export function CreateStoreScreen() {
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(storeSchema), defaultValues: { name: '', address: '', phone: '', email: '' } });
  const onSubmit = handleSubmit(async (v) => { setError(''); try { await authService.createStore(v); /* session bootstrap reloads memberships and routes into the app */ } catch (e) { setError(friendlyError(e)); } });
  return (
    <Screen><ScrollView keyboardShouldPersistTaps="handled">
      <Title>Set up your store</Title><Sub>You become the Owner. You can invite managers and cashiers later.</Sub>
      {!!error && <ErrorBox message={error} />}
      <Controller control={control} name="name" render={({ field: { onChange, value } }) => <Field label="Store name" value={value} onChangeText={onChange} error={errors.name?.message} />} />
      <Controller control={control} name="address" render={({ field: { onChange, value } }) => <Field label="Address (optional)" value={value} onChangeText={onChange} />} />
      <Controller control={control} name="phone" render={({ field: { onChange, value } }) => <Field label="Phone (optional)" value={value} onChangeText={onChange} />} />
      <Button title="Create store" onPress={onSubmit} loading={isSubmitting} />
      <Button title="Sign out" variant="ghost" onPress={() => authService.signOut()} />
    </ScrollView></Screen>
  );
}

export function ProfileScreen() {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [msg, setMsg] = useState(''); const [newPassword, setNewPassword] = useState('');
  const { useSession } = require('@/store/appStore') as typeof import('@/store/appStore');
  const userId = useSession((s: { userId: string | null }) => s.userId);
  const email = useSession((s: { email: string | null }) => s.email);
  const role = useSession((s: { role: string | null }) => s.role);
  const store = useSession((s: { store: { name: string } | null }) => s.store);
  return (
    <Screen><ScrollView>
      <Title>Profile</Title><Sub>{email} · {role} · {store?.name}</Sub>
      <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {!!msg && <Sub>{msg}</Sub>}
      <Button title="Save profile" onPress={async () => { if (userId) { await authService.updateProfile(userId, { full_name: name, phone }); setMsg('Profile saved.'); } }} />
      <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Min 6 characters" />
      <Button title="Change password" onPress={async () => { if (newPassword.length < 6) { Alert.alert('Password too short', 'Use at least 6 characters.'); return; } await authService.updatePassword(newPassword); setNewPassword(''); setMsg('Password updated.'); }} />
      <Button title="Sign out" variant="danger" onPress={() => authService.signOut()} />
    </ScrollView></Screen>
  );
}
