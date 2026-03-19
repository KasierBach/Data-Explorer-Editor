import React from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { cn } from '@/lib/utils';

interface PricingSectionProps {
    lang: string;
    addToRevealRefs: (el: HTMLDivElement | null) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ lang, addToRevealRefs }) => {
    const packages = [
        {
            tier: lang === 'vi' ? "Cộng đồng" : "Community",
            price: "$0",
            desc: lang === 'vi' ? "Hoàn hảo cho các nhà phát triển độc lập và sinh viên." : "Perfect for independent developers and students.",
            features: lang === 'vi'
                ? ["Kết nối DB cục bộ", "AI Cơ bản (Gemini Flash)", "Biểu đồ tiêu chuẩn", "Lược đồ tự động"]
                : ["Local DB Connections", "Basic AI (Gemini Flash)", "Standard Charting", "Auto-schema detection"],
            cta: lang === 'vi' ? "Bắt đầu ngay" : "Get Started",
            popular: false
        },
        {
            tier: "Pro",
            price: "$19",
            desc: lang === 'vi' ? "Công cụ nâng cao cho các chuyên gia dữ liệu và nhóm." : "Advanced tools for data professionals and teams.",
            features: lang === 'vi'
                ? ["Đồng bộ Cloud DB", "AI Nâng cao (Gemini Pro)", "Sơ đồ ER tương tác", "Truyền phát SSE ưu tiên", "Giấy phép thương mại"]
                : ["Cloud DB Syncing", "Advanced AI (Gemini Pro)", "Interactive ER Diagrams", "Priority SSE Streaming", "Commercial License"],
            cta: lang === 'vi' ? "Mua ngay" : "Buy Now",
            popular: true
        },
        {
            tier: lang === 'vi' ? "Doanh nghiệp" : "Enterprise",
            price: lang === 'vi' ? "Liên hệ" : "Custom",
            desc: lang === 'vi' ? "Hạ tầng dành riêng cho các tổ chức ưu tiên bảo mật." : "Dedicated infrastructure for security-first organizations.",
            features: lang === 'vi'
                ? ["Thực thể AI riêng biệt", "Xác thực SSO & SAML", "Nhật ký kiểm tra", "Gắn nhãn trắng", "Quản lý tài khoản riêng"]
                : ["Dedicated AI Instance", "SSO & SAML Auth", "Audit Logging", "White-labeling", "Dedicated Account Manager"],
            cta: lang === 'vi' ? "Liên hệ Sales" : "Contact Sales",
            popular: false
        }
    ];

    return (
        <section id="pricing" className="py-20 relative">
            <div className="container mx-auto px-4 sm:px-6">
                <div ref={addToRevealRefs} className="reveal text-center mb-16 max-w-2xl mx-auto">
                    <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 uppercase">
                        {lang === 'vi' ? 'Bảng giá Minh bạch' : 'Transparent Pricing'}
                    </h2>
                    <p className="text-muted-foreground text-lg font-medium opacity-70">
                        {lang === 'vi'
                            ? 'Bắt đầu miễn phí, mở rộng khi bạn sẵn sàng. Không phí ẩn, chỉ có sức mạnh thuần túy.'
                            : "Start for free, scale when you're ready. No hidden fees, just raw power."}
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {packages.map((pkg, i) => (
                        <div key={i} ref={addToRevealRefs} className={cn(
                            "reveal glass-panel p-6 md:p-8 rounded-3xl border flex flex-col items-start gap-6 relative group transition-all duration-500",
                            pkg.popular ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20 lg:scale-105" : "border-white/5",
                            `stagger-${i + 1}`
                        )}>
                            {pkg.popular && (
                                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white font-black px-4 py-1">MOST POPULAR</Badge>
                            )}
                            <div className="space-y-1">
                                <h3 className="font-black text-xl text-foreground uppercase tracking-tight">{pkg.tier}</h3>
                                <p className="text-xs text-muted-foreground font-medium h-8">{pkg.desc}</p>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black">{pkg.price}</span>
                                {pkg.price !== "Custom" && <span className="text-muted-foreground text-xs font-medium">/month</span>}
                            </div>
                            <div className="w-full h-px bg-white/5" />
                            <ul className="space-y-3 flex-1 mb-4">
                                {pkg.features.map(f => (
                                    <li key={f} className="flex items-center gap-2 text-xs font-medium text-muted-foreground/80">
                                        <Zap className="w-3 h-3 text-blue-500" /> {f}
                                    </li>
                                ))}
                            </ul>
                            <Button className={cn(
                                "w-full rounded-xl font-black uppercase tracking-widest text-[10px] h-12",
                                pkg.popular ? "bg-blue-600 hover:bg-blue-700 text-white" : "glass-panel bg-white/5 hover:bg-white/10"
                            )}>
                                {pkg.cta}
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
