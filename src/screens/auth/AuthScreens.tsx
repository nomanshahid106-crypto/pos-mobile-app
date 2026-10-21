import React, { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Button, ErrorBox, Field, Screen, Sub, Title } from '@/components/ui';
import { authService } from '@/services';
import { friendlyError } from '@/lib/supabase';
import { loginSchema, registerSchema, storeSchema } from '@/validation/schemas';

export function LoginScreen() {
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const onSubmit = handleSubmit(async (v) => { setError(''); try { await authService.signIn(v.email.trim(), v.password); } catch (e) { setError(friendlyError(e)); } });
  return (
    <Screen><ScrollView keyboardShouldPersistTaps="handled">
      <Title>POS Pro</Title><Sub>Sign in to your store</Sub>
      {!!error && <ErrorBox message={error} />}
      <Controller control={control} name="email" render={({ field: { onChange, value } }) => <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={value} onChangeText={onChange} error={errors.email?.message} />} />
      <Controller control={control} name="password" render={({ field: { onChange, value } }) => <Field label="Password" secureTextEntry value={value} onChangeText={onChange} error={errors.password?.message} />} />
      <Button title="Sign in" onPress={onSubmit} loading={isSubmitting} />
      <Button title="Create an account" variant="ghost" onPress={() => router.push('/(auth)/register')} />
      <Button title="Forgot password?" variant="ghost" onPress={() => router.push('/(auth)/forgot-password')} />
    </ScrollView></Screen>
  );
}

export function RegisterScreen() {
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema), defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' } });
  const onSubmit = handleSubmit(async (v) => { setError(''); try { const res = await authService.signUp(v.email.trim(), v.password, v.fullName.trim()) as unknown as { session?: unknown }; if (!res?.session) Alert.alert('Check your email', 'Confirm your email address, then sign in.'); } catch (e) { setError(friendlyError(e)); } });
  return (
    <Screen><ScrollView keyboardShouldPersistTaps="handled">
      <Title>Create account</Title>
      {!!error && <ErrorBox message={error} />}
      <Controller control={control} name="fullName" render={({ field: { onChange, value } }) => <Field label="Full name" value={value} onChangeText={onChange} error={errors.fullName?.message} />} />
      <Controller control={control} name="email" render={({ field: { onChange, value } }) => <Field label="Email" autoCapitalize="none" keyboardType="email-address" value={value} onChangeText={onChange} error={errors.email?.message} />} />
      <Controller control={control} name="password" render={({ field: { onChange, value } }) => <Field label="Password" secureTextEntry value={value} onChangeText={onChange} error={errors.password?.message} />} />
      <Controller control={control} name="confirmPassword" render={({ field: { onChange, value } }) => <Field label="Confirm password" secureTextEntry value={value} onChangeText={onChange} error={errors.confirmPassword?.message} />} />
      <Button title="Register" onPress={onSubmit} loading={isSubmitting} />
      <Button title="Back to sign in" variant="ghost" onPress={() => router.back()} />
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
