import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { DEFAULT_CATEGORIES, INITIAL_LINKS } from '../types';

interface InitSetupPageProps {
  onSetupComplete: () => void;
}

export default function InitSetupPage({ onSetupComplete }: InitSetupPageProps) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 密码强度检查
  const getPasswordStrength = (pwd: string): { level: number; text: string; color: string } => {
    if (pwd.length === 0) return { level: 0, text: '', color: '' };
    if (pwd.length < 6) return { level: 1, text: '太短', color: 'bg-red-500' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 1) return { level: 1, text: '弱', color: 'bg-red-500' };
    if (score <= 2) return { level: 2, text: '一般', color: 'bg-yellow-500' };
    if (score <= 3) return { level: 3, text: '中等', color: 'bg-blue-500' };
    return { level: 4, text: '强', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initAdmin: true,
          password: password,
        }),
      });

      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || '设置失败');
      }

      // 设置成功，保存 token 到 localStorage
      localStorage.setItem('cloudnav_auth_token', password);
      localStorage.setItem('lastLoginTime', Date.now().toString());

      // 上传默认分类和链接数据
      const uploadResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password,
        },
        body: JSON.stringify({
          links: INITIAL_LINKS,
          categories: DEFAULT_CATEGORIES,
        }),
      });

      if (!uploadResponse.ok) {
        console.error('Failed to upload default data');
      }

      // 同时保存到本地缓存
      localStorage.setItem('cloudnav_data_cache', JSON.stringify({
        links: INITIAL_LINKS,
        categories: DEFAULT_CATEGORIES,
      }));

      onSetupComplete();
      navigate('/');
    } catch (err: any) {
      setError(err.message || '设置失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">欢迎使用 CloudNav</h1>
          <p className="text-slate-400">首次使用，请设置管理员密码</p>
        </div>

        {/* 设置表单 */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 密码输入 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                管理员密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码（至少6位）"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* 密码强度指示器 */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= passwordStrength.level ? passwordStrength.color : 'bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.level <= 1 ? 'text-red-400' :
                    passwordStrength.level <= 2 ? 'text-yellow-400' :
                    passwordStrength.level <= 3 ? 'text-blue-400' : 'text-green-400'
                  }`}>
                    密码强度：{passwordStrength.text}
                  </p>
                </div>
              )}
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                确认密码
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* 密码匹配提示 */}
              {confirmPassword.length > 0 && (
                <div className="mt-2 flex items-center gap-1">
                  {password === confirmPassword ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400">密码匹配</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-400">密码不匹配</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading || password.length < 6 || password !== confirmPassword}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  设置中...
                </>
              ) : (
                '完成设置'
              )}
            </button>
          </form>

          {/* 提示信息 */}
          <div className="mt-6 p-4 bg-slate-700/30 rounded-xl">
            <h3 className="text-sm font-medium text-slate-300 mb-2">安全提示</h3>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• 密码将用于管理导航站的所有内容</li>
              <li>• 建议使用包含大小写字母、数字和特殊字符的强密码</li>
              <li>• 密码会以加密形式存储，请妥善保管</li>
            </ul>
          </div>
        </div>

        {/* 底部信息 */}
        <p className="text-center text-slate-500 text-sm mt-6">
          CloudNav - 您的个人云端导航站
        </p>
      </div>
    </div>
  );
}
