import React, { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { SEO } from '../components/shared/Seo';
import { LandingHeader } from '../modules/LandingPage/components/LandingHeader';
import { InteractiveBackground } from '../modules/LandingPage/components/InteractiveBackground';
import { LandingFooter } from '../modules/LandingPage/components/LandingFooter';
import { motion } from 'framer-motion';
import { Sparkles, Database, Code2, ShieldCheck, Zap, Globe, TestTube, FileCode, Settings, Users } from 'lucide-react';
import { AuthService } from '@/core/services/AuthService';

export const ChangelogPage: React.FC = () => {
    const { isAuthenticated, lang } = useAppStore();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    const releases = [
        // v3.6.0 - Mid May 2026
        {
            version: 'v3.6.0',
            date: lang === 'vi' ? 'Giữa Tháng 5, 2026' : 'Mid May, 2026',
            title: lang === 'vi' ? 'Kiến trúc Cơ sở AI & AI Reasoning Xuyên thấu' : 'AI foundational Architecture & Reasoning Transparency',
            badge: 'LATEST',
            features: [
                {
                    icon: <Sparkles className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'Xuyên thấu Suy nghĩ AI (Reasoning Transparency)' : 'AI Reasoning Transparency',
                    desc: lang === 'vi'
                        ? 'Bổ sung block "Thought" có thể gập mở ngay trong khung chat (AiMessageBubble) để hiển thị toàn bộ quá trình tóm tắt và phân tích logic của AI, tăng độ trong suốt và đáng tin cậy.'
                        : "Added a collapsible 'Thought' block within the chat interface displaying the AI's logical analysis and reasoning process, enhancing transparency and trust."
                },
                {
                    icon: <Globe className="w-5 h-5 text-blue-400" />,
                    title: lang === 'vi' ? 'Cấu trúc Giao tiếp & Fallback (Dynamic AI Routing)' : 'Dynamic AI Routing & Fallback',
                    desc: lang === 'vi'
                        ? 'Tái cấu trúc toàn rễ backend với các module ai.routing.service và ai.provider-runner nhằm hỗ trợ mạng lưới mô hình đa dạng (OpenRouter, Groq), cùng cơ chế fallback siêu mượt nếu model chính bị quá tải.'
                        : 'Deep backend refactor introducing ai.routing.service and provider runners to support diverse model networks (OpenRouter, Groq) with seamless fallback mechanisms.'
                },
                {
                    icon: <Database className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'Mở rộng Trợ lý AI cho NoSQL (NoSQL AI Integration)' : 'NoSQL AI Assistant Integration',
                    desc: lang === 'vi'
                        ? 'Phát triển NoSqlAiQueryBox mới toanh, mang toàn bộ sức mạnh hoàn thiện mã, sửa lỗi cú pháp và khởi tạo query NoSQL vào trong không gian làm việc MongoDB.'
                        : 'Developed the brand new NoSqlAiQueryBox, bringing full code completion, syntax fixing, and query generation power into the MongoDB workspace.'
                },
                {
                    icon: <Code2 className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Nâng cấp Quản lý State & UI Chat' : 'Chat State & UI Overhaul',
                    desc: lang === 'vi'
                        ? 'Đập đi xây lại luồng quản lý hội thoại với aiChatSlice, useAiChat, và component AiChatInput mới để hỗ trợ lịch sử ngữ cảnh dài hạn và giao diện gõ code đa dòng mượt mà.'
                        : 'Overhauled the conversational state flow using aiChatSlice, useAiChat, and the new AiChatInput component to support semantic history memory and multi-line interactions.'
                },
                {
                    icon: <Zap className="w-5 h-5 text-yellow-400" />,
                    title: lang === 'vi' ? 'Khóa cứng Autocomplete (Ghost Text Hardening)' : 'Autocomplete Hardening',
                    desc: lang === 'vi'
                        ? 'Siết chặt context qua ai.prompt-builder, xử lý triệt để lỗi treo UI (hangs) với strict timeouts, và ưu tiên đẩy mạnh hiệu năng cho các mô hình chớp nhoáng như Gemini Flash Preview.'
                        : 'Tightened context via ai.prompt-builder, completely eliminating UI hangs with strict timeouts, and aggressively prioritizing ultra-fast models like Gemini Flash Preview.'
                }
            ]
        },
        // v3.5.0 - May 8, 2026
        {
            version: 'v3.5.0',
            date: lang === 'vi' ? '8 Tháng 5, 2026' : 'May 8, 2026',
            title: lang === 'vi' ? 'NoSQL Explorer Parity & UX Refinement' : 'NoSQL Explorer Parity & UX Refinement',
            badge: '',
            features: [
                {
                    icon: <Zap className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'NoSQL Workspace Parity' : 'NoSQL Workspace Parity',
                    desc: lang === 'vi'
                        ? 'Đưa các phím tắt (Ctrl+J, Ctrl+Enter), menu File/Edit và các công cụ Visualize/Diagram lên NoSQL để đồng nhất trải nghiệm với SQL.'
                        : 'Brought shortcuts (Ctrl+J, Ctrl+Enter), File/Edit menus, and Visualize/Diagram tools to NoSQL for a unified workspace experience.'
                },
                {
                    icon: <FileCode className="w-5 h-5 text-indigo-400" />,
                    title: lang === 'vi' ? 'Version History & Metadata Freshness' : 'Version History & Metadata Freshness',
                    desc: lang === 'vi'
                        ? 'Theo dõi lịch sử phiên bản của các thực thể và tự động cập nhật độ tươi mới của metadata để đảm bảo dữ liệu luôn chính xác.'
                        : 'Track version history for entities and automatically monitor metadata freshness to ensure your data is always up to date.'
                },
                {
                    icon: <ShieldCheck className="w-5 h-5 text-red-400" />,
                    title: lang === 'vi' ? 'Org Backup & Migration Preview' : 'Org Backup & Migration Preview',
                    desc: lang === 'vi'
                        ? 'Hệ thống sao lưu tổ chức và công cụ xem trước migration, giúp chuyển đổi hạ tầng an toàn hơn bao giờ hết.'
                        : 'Organization backup system and migration preview tools, making infrastructure transitions safer than ever.'
                },
                {
                    icon: <Users className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Real-time Presence Tracking' : 'Real-time Presence Tracking',
                    desc: lang === 'vi'
                        ? 'Biết được thành viên nào trong nhóm đang cùng hoạt động trong không gian làm việc nhờ hệ thống theo dõi hiện diện thời gian thực.'
                        : 'See which team members are active in the workspace in real-time with our new presence tracking system.'
                },
                {
                    icon: <Sparkles className="w-5 h-5 text-blue-400" />,
                    title: lang === 'vi' ? 'Persistent Workspace State' : 'Persistent Workspace State',
                    desc: lang === 'vi'
                        ? 'Ghi nhớ chiều cao bảng kết quả, chế độ xem (Tree/Grid) và Aggregation stages ngay cả khi tải lại trang.'
                        : 'Automatically remembers result panel height, view modes (Tree/Grid), and Aggregation stages across page refreshes.'
                },
                {
                    icon: <Globe className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'Universal Visualize Hub' : 'Universal Visualize Hub',
                    desc: lang === 'vi'
                        ? 'Trang Trực quan hóa giờ đây hỗ trợ đầy đủ NoSQL, cho phép tạo biểu đồ từ dữ liệu MongoDB một cách mượt mà.'
                        : 'The Visualization page now fully supports NoSQL, enabling seamless chart creation from MongoDB data.'
                }
            ]
        },
        // v3.4.0 - Early May 2026
        {
            version: 'v3.4.0',
            date: lang === 'vi' ? 'Đầu Tháng 5, 2026' : 'Early May 2026',
            title: lang === 'vi' ? 'Advanced Security & Infrastructure Hardening' : 'Advanced Security & Infrastructure Hardening',
            badge: '',
            features: [
                {
                    icon: <ShieldCheck className="w-5 h-5 text-red-400" />,
                    title: lang === 'vi' ? 'Enterprise-Grade Security Hardening' : 'Enterprise-Grade Security Hardening',
                    desc: lang === 'vi'
                        ? 'Khóa chặt SQL Guard chống lách luật EXEC, chặn đứng lỗ hổng SSRF qua SSH Tunnel và siết chặt quyền riêng tư team.'
                        : 'Reinforced SQL Guard against EXEC bypasses, neutralized SSH Tunnel SSRF, and tightened team privacy logic.'
                },
                {
                    icon: <Sparkles className="w-5 h-5 text-blue-400" />,
                    title: lang === 'vi' ? 'Advanced Data Privacy' : 'Advanced Data Privacy',
                    desc: lang === 'vi'
                        ? 'Sanitize lỗi database chi tiết để tránh rò rỉ thông tin hạ tầng và bảo mật lại thông tin xác thực admin mặc định.'
                        : 'Sanitized detailed DB errors to prevent infrastructure leakage and secured default admin credentials.'
                },
                {
                    icon: <Settings className="w-5 h-5 text-amber-400" />,
                    title: lang === 'vi' ? 'Migration Guardrails' : 'Migration Guardrails',
                    desc: lang === 'vi'
                        ? 'Áp dụng timeout an toàn cho các tiến trình migration lớn để tránh treo tài nguyên hệ thống.'
                        : 'Applied safety timeouts for large migration processes to prevent resource exhaustion.'
                },
                {
                    icon: <Zap className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'Pentest & Security Validation' : 'Pentest & Security Validation',
                    desc: lang === 'vi'
                        ? 'Hoàn thành đợt kiểm tra an ninh nâng cao (Pentest Level 2) với các kịch bản tấn công logic thực tế.'
                        : 'Completed Advanced Security Audit (Pentest Level 2) with real-world logic attack scenarios.'
                }
            ]
        },
        // v3.3.1 - Late April 2026
        {
            version: 'v3.3.1',
            date: lang === 'vi' ? 'Cuối Tháng 4, 2026' : 'Late April 2026',
            title: lang === 'vi' ? 'Team Collaboration & Mobile Polish' : 'Team Collaboration & Mobile Polish',
            badge: '',
            features: [
                {
                    icon: <Sparkles className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'Organizations & Shared Workspaces' : 'Organizations & Shared Workspaces',
                    desc: lang === 'vi'
                        ? 'Thêm nền tảng team collaboration với organizations, members, roles, và shared connections / queries / dashboards.'
                        : 'Add the collaboration base for organizations, members, roles, and shared connections / queries / dashboards.'
                },
                {
                    icon: <Globe className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Mobile Collaboration Access' : 'Mobile Collaboration Access',
                    desc: lang === 'vi'
                        ? 'Teams giờ có thể mở từ menu avatar trên mobile, và các màn workspace, dialog, admin được siết lại để thân thiện hơn trên màn nhỏ.'
                        : 'Teams is now reachable from the mobile avatar menu, while workspace, dialog, and admin screens are tuned for smaller displays.'
                },
                {
                    icon: <TestTube className="w-5 h-5 text-amber-400" />,
                    title: lang === 'vi' ? 'Connection Diagnostics' : 'Connection Diagnostics',
                    desc: lang === 'vi'
                        ? 'ConnectionDialog có Test Connection, đi kèm sửa lỗi UI và tinh chỉnh lại trải nghiệm thiết lập kết nối.'
                        : 'ConnectionDialog gains Test Connection, plus UI fixes and a smoother connection setup flow.'
                },
                {
                    icon: <Database className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'Realtime Stability' : 'Realtime Stability',
                    desc: lang === 'vi'
                        ? 'Thông báo SSE, cache, và luồng cập nhật nền được đồng bộ lại với backend API và hạ tầng Redis hiện tại.'
                        : 'SSE notifications, cache, and background update flows are aligned with the current backend API and Redis infrastructure.'
                }
            ]
        },
        // v3.3.0 - April 2026
        {
            version: 'v3.3.0',
            date: lang === 'vi' ? 'Giữa Tháng 4, 2026' : 'Mid April 2026',
            title: lang === 'vi' ? 'AI Thế Hệ Mới & Type Safety Toàn Diện' : 'Next-Gen AI & Comprehensive Type Safety',
            badge: '',
            features: [
                {
                    icon: <Sparkles className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'AI Service Decomposition' : 'AI Service Decomposition',
                    desc: lang === 'vi' ? 'Tách AI service thành các sub-services chuyên biệt: routing, provider runner, chat completion, autocomplete.' : 'Decompose AI service into specialized sub-services: routing, provider runner, chat completion, autocomplete.'
                },
                {
                    icon: <Code2 className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'Type Safety Hoàn Toàn' : 'Complete Type Safety',
                    desc: lang === 'vi' ? 'Loại bỏ tất cả any types, constraint generics, extract AI constants, cải thiện code quality theo SOLID, KISS, YAGNI, DRY.' : 'Remove all any types, constrain generics, extract AI constants, improve code quality following SOLID, KISS, YAGNI, DRY principles.'
                },
                {
                    icon: <Database className="w-5 h-5 text-red-400" />,
                    title: lang === 'vi' ? 'Redis Caching & Global Search' : 'Redis Caching & Global Search',
                    desc: lang === 'vi' ? 'Query result caching, global schema search, real-time SSE notifications, và optimized session management.' : 'Query result caching, global schema search, real-time SSE notifications, and optimized session management.'
                },
                {
                    icon: <Zap className="w-5 h-5 text-yellow-400" />,
                    title: lang === 'vi' ? 'AI-Powered SQL Generation' : 'AI-Powered SQL Generation',
                    desc: lang === 'vi' ? 'Tạo SQL tự động từ ngôn ngữ tự nhiên và semantic search cho database objects.' : 'Auto-generate SQL from natural language and semantic search for database objects.'
                }
            ]
        },
        // v3.2.0 - April 2026
        {
            version: 'v3.2.0',
            date: lang === 'vi' ? 'Đầu Tháng 4, 2026' : 'Early April 2026',
            title: lang === 'vi' ? 'ERD Thông Minh & Real-time Notifications' : 'Smart ERD & Real-time Notifications',
            badge: '',
            features: [
                {
                    icon: <Code2 className="w-5 h-5 text-blue-400" />,
                    title: lang === 'vi' ? 'ERD Performance Optimization' : 'ERD Performance Optimization',
                    desc: lang === 'vi' ? 'Tối ưu hóa performance và visual clarity với Redis caching và smart suggestions cho ERD visualization.' : 'Optimize performance and visual clarity with Redis caching and smart suggestions for ERD visualization.'
                },
                {
                    icon: <Globe className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Real-time SSE Notifications' : 'Real-time SSE Notifications',
                    desc: lang === 'vi' ? 'Thông báo real-time qua Server-Sent Events cho query status và system updates.' : 'Real-time notifications via Server-Sent Events for query status and system updates.'
                },
                {
                    icon: <TestTube className="w-5 h-5 text-amber-400" />,
                    title: lang === 'vi' ? 'Client-side Testing Suite' : 'Client-side Testing Suite',
                    desc: lang === 'vi' ? 'Thêm unit tests cho ConnectionService và SavedQueryService, đảm bảo reliability.' : 'Add unit tests for ConnectionService and SavedQueryService, ensuring reliability.'
                }
            ]
        },
        // v3.1.0 - March 2026
        {
            version: 'v3.1.0',
            date: lang === 'vi' ? 'Cuối Tháng 3, 2026' : 'Late March 2026',
            title: lang === 'vi' ? 'UI Upgrade & Hooks Refinement' : 'UI Upgrade & Hooks Refinement',
            badge: '',
            features: [
                {
                    icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'Cinematic Dark Mode Landing Page' : 'Cinematic Dark Mode Landing Page',
                    desc: lang === 'vi' ? 'Nâng cấp giao diện landing page với dark mode cinematic, animations mượt mà và visual effects.' : 'Upgrade landing page UI with cinematic dark mode, smooth animations and visual effects.'
                },
                {
                    icon: <Code2 className="w-5 h-5 text-yellow-400" />,
                    title: lang === 'vi' ? 'Query ERD Hooks Alignment' : 'Query ERD Hooks Alignment',
                    desc: lang === 'vi' ? 'Căn chỉnh Query và ERD hooks, fix TypeScript errors và clean up unused code.' : 'Align Query and ERD hooks, fix TypeScript errors and clean up unused code.'
                }
            ]
        },
        // v3.0.5 - March 2026
        {
            version: 'v3.0.5',
            date: lang === 'vi' ? 'Giữa Tháng 3, 2026' : 'Mid March 2026',
            title: lang === 'vi' ? 'Code Quality & Type Fixes' : 'Code Quality & Type Fixes',
            badge: '',
            features: [
                {
                    icon: <Settings className="w-5 h-5 text-blue-400" />,
                    title: lang === 'vi' ? 'SOLID, KISS, YAGNI, DRY Refactoring' : 'SOLID, KISS, YAGNI, DRY Refactoring',
                    desc: lang === 'vi' ? 'Cải thiện code quality với các nguyên tắc thiết kế phần mềm.' : 'Improve code quality with software design principles.'
                },
                {
                    icon: <FileCode className="w-5 h-5 text-green-400" />,
                    title: lang === 'vi' ? 'TypeScript Error Resolution' : 'TypeScript Error Resolution',
                    desc: lang === 'vi' ? 'Fix TypeScript errors, clean up unused props và types.' : 'Fix TypeScript errors, clean up unused props and types.'
                }
            ]
        },
        // v3.0.0 - January 2026
        {
            version: 'v3.0.0',
            date: lang === 'vi' ? 'Cuối Tháng 1, 2026' : 'Late January 2026',
            title: lang === 'vi' ? 'Nền Tảng Cốt Lõi' : 'The Core Platform Genesis',
            badge: '',
            features: [
                {
                    icon: <Database className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Kiến trúc NestJS & Prisma' : 'NestJS & Prisma Backbone',
                    desc: lang === 'vi' ? 'Backend ổn định hỗ trợ OAuth, JWT, mã hóa AES-256-GCM.' : 'Stable backend supporting OAuth, JWT, and AES-256-GCM encryption.'
                },
                {
                    icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'Auth Service Spec' : 'Auth Service Specification',
                    desc: lang === 'vi' ? 'Thêm auth service specification và agent directory configuration.' : 'Add auth service specification and agent directory configuration.'
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden relative">
            <SEO 
                lang={lang} 
                title={lang === 'vi' ? "Changelog | Data Explorer" : "Changelog | Data Explorer"}
                description={lang === 'vi' ? "Cập nhật mới nhất của nền tảng Data Explorer." : "The latest updates from the Data Explorer platform."}
            />
            <InteractiveBackground />

            <LandingHeader 
                lang={lang} 
                isAuthenticated={isAuthenticated} 
                logout={handleLogout}
                isMobileNavOpen={isMobileNavOpen}
                setIsMobileNavOpen={setIsMobileNavOpen}
                hideSectionLinks={true}
            />

            <main className="flex-1 relative z-10 pt-32 pb-24">
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 uppercase bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                            {lang === 'vi' ? 'Bản ghi Cập nhật' : 'Changelog'}
                        </h1>
                        <p className="text-muted-foreground text-lg font-medium max-w-2xl mx-auto">
                            {lang === 'vi' 
                                ? 'Theo dõi hành trình phát triển của hệ quản trị cơ sở dữ liệu thế hệ mới.' 
                                : 'Track the journey of the next-generation database management IDE.'}
                        </p>
                    </div>

                    <div className="space-y-16">
                        {releases.map((release, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="relative border-l border-white/10 pl-8 md:pl-12 ml-4 md:ml-0"
                            >
                                <div className="absolute w-4 h-4 rounded-full bg-blue-500 -left-[8.5px] top-1 shadow-[0_0_15px_rgba(59,130,246,0.5)] border-2 border-background" />
                                
                                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                    <h2 className="text-2xl md:text-3xl font-black tracking-tight">{release.version}</h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground/60 text-sm font-medium">{release.date}</span>
                                        {release.badge && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-widest uppercase">
                                                {release.badge}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-lg md:text-xl font-bold mb-6 text-white/90">{release.title}</h3>

                                <div className="space-y-4">
                                    {release.features.map((feat, fidx) => (
                                        <div key={fidx} className="glass-panel p-5 rounded-2xl border-white/5 hover:border-white/10 transition-colors flex gap-4">
                                            <div className="mt-1 flex-shrink-0">
                                                {feat.icon}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white/90 mb-1">{feat.title}</h4>
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    {feat.desc}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </main>

            <LandingFooter lang={lang} />
        </div>
    );
};
