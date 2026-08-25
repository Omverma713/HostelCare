import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, Building2, KeyRound, ArrowRight, ShieldCheck, Sparkles, HelpCircle } from 'lucide-react';
import { triggerToast } from '../components/Toast';
import FuturisticLoader from './login/FuturisticLoader';

export default function CinematicLoginForm({
  onLogin,
  onActivate,
  loading = false,
  selectedRole,
  setSelectedRole,
}) {
  const [activeTab, setActiveTab] = useState('login');
  
  // Login Form State
  const [regNum, setRegNum] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Activation Form State
  const [actRegNum, setActRegNum] = useState('');
  const [actHostel, setActHostel] = useState('');
  const [actRoom, setActRoom] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!regNum.trim() || !password) {
      triggerToast('error', 'Please enter your Registration Number and Password.');
      return;
    }
    if (onLogin) {
      onLogin(regNum.trim(), password);
    }
  };

  const handleActivateSubmit = (e) => {
    e.preventDefault();
    if (!actRegNum.trim() || !actHostel.trim() || !newPassword || !confirmPassword) {
      triggerToast('error', 'All activation fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerToast('error', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      triggerToast('error', 'Password must be at least 6 characters.');
      return;
    }
    if (onActivate) {
      onActivate({
        regNum: actRegNum.trim(),
        hostel: actHostel.trim(),
        room: actRoom.trim(),
        newPassword,
        confirmPassword,
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Role Selector Switcher */}
      <div className="flex items-center p-1 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800/90 shadow-inner">
        <button
          type="button"
          onClick={() => setSelectedRole(null)}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            selectedRole === null
              ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Users
        </button>
        <button
          type="button"
          onClick={() => setSelectedRole('student')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            selectedRole === 'student'
              ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md shadow-cyan-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Student
        </button>
        <button
          type="button"
          onClick={() => setSelectedRole('admin')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
            selectedRole === 'admin'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Admin / Staff
        </button>
      </div>

      {/* Tabs: Sign In / Activate Account */}
      <div className="flex border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('login')}
          className={`flex-1 pb-2.5 text-xs font-bold tracking-wider uppercase transition-all relative cursor-pointer ${
            activeTab === 'login'
              ? 'text-cyan-300 font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sign In
          {activeTab === 'login' && (
            <span className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activate')}
          className={`flex-1 pb-2.5 text-xs font-bold tracking-wider uppercase transition-all relative cursor-pointer ${
            activeTab === 'activate'
              ? 'text-cyan-300 font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          First-Time Activation
          {activeTab === 'activate' && (
            <span className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          )}
        </button>
      </div>

      {/* Sign In Form */}
      {activeTab === 'login' && (
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3.5">
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              Registration Number / ID
            </label>
            <input
              type="text"
              value={regNum}
              onChange={(e) => setRegNum(e.target.value)}
              placeholder="e.g. 21BCExxxx or admin@hostel"
              required
              className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-slate-100 placeholder-slate-500 text-sm rounded-xl px-4 py-2.5 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-slate-100 placeholder-slate-500 text-sm rounded-xl pl-4 pr-11 py-2.5 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Remember this session</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 relative group overflow-hidden rounded-xl p-px font-semibold text-sm shadow-xl shadow-cyan-950/50 disabled:opacity-50 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 rounded-xl transition-all duration-300 group-hover:opacity-100 group-hover:scale-105" />
            <div className="relative flex items-center justify-center gap-2 px-6 py-3 rounded-[11px] bg-slate-950/85 transition-all duration-300 group-hover:bg-transparent text-white font-bold">
              {loading ? (
                <div className="flex items-center justify-center py-0.5">
                  <FuturisticLoader size="sm" />
                </div>
              ) : (
                <>
                  <span>Access HostelCare</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </form>
      )}

      {/* Activation Form */}
      {activeTab === 'activate' && (
        <form onSubmit={handleActivateSubmit} className="flex flex-col gap-3 text-left">
          <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-[11px] text-cyan-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>Activate your pre-registered student profile to set your password.</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
              Registration Number
            </label>
            <input
              type="text"
              value={actRegNum}
              onChange={(e) => setActRegNum(e.target.value)}
              placeholder="e.g. 21BCE1001"
              required
              className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-cyan-500 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
                Hostel Block
              </label>
              <input
                type="text"
                value={actHostel}
                onChange={(e) => setActHostel(e.target.value)}
                placeholder="e.g. Block-A"
                required
                className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-cyan-500 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
                Room No
              </label>
              <input
                type="text"
                value={actRoom}
                onChange={(e) => setActRoom(e.target.value)}
                placeholder="e.g. 302"
                className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-cyan-500 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
                New Password
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 chars"
                required
                className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-cyan-500 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
                Confirm
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type"
                required
                className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-cyan-500 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-emerald-950/50 transition-all cursor-pointer flex items-center justify-center min-h-[38px]"
          >
            {loading ? <FuturisticLoader size="sm" /> : 'Activate & Continue to Login'}
          </button>
        </form>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Account Recovery</h3>
                <p className="text-xs text-slate-400">HostelCare Security Protocol</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              If you have forgotten your password, contact your respective 
              <strong> Hostel Warden Office</strong> or institutional support.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400">
              Support Desk: <span className="text-cyan-300 font-mono">support@hostelcare.internal</span>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
