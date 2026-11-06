import type { ComponentType } from 'react';
import type { PublicPageKind, PublicRoute } from '@/core/seo/publicRoutes';

export interface PublicViewProps {
    route: PublicRoute;
    isAuthenticated?: boolean;
    isMotionPaused?: boolean;
    onToggleMotion?: () => void;
}

export type PublicView = ComponentType<PublicViewProps>;

const views = new Map<PublicPageKind, Promise<PublicView>>();

export function loadPublicView(route: PublicRoute): Promise<PublicView> {
    const existing = views.get(route.kind);
    if (existing) return existing;
    let view: Promise<PublicView>;
    if (route.kind === 'landing') {
        view = import('./LandingBody').then(({ LandingBody }) => function LandingView(props: PublicViewProps) {
            return <LandingBody lang={props.route.lang} isAuthenticated={props.isAuthenticated} paused={props.isMotionPaused} onToggleMotion={props.onToggleMotion} />;
        });
    } else if (route.kind === 'docs') {
        view = import('./DocumentationView').then(module => module.DocumentationView);
    } else if (route.kind === 'changelog') {
        view = import('./ChangelogView').then(({ ChangelogView }) => function ChangelogPageView(props: PublicViewProps) {
            return <ChangelogView lang={props.route.lang} />;
        });
    } else {
        view = import('./LegalDocumentView').then(({ LegalDocumentView }) => function LegalPageView(props: PublicViewProps) {
            return <LegalDocumentView docKey={props.route.kind as 'legal' | 'privacy' | 'terms'} lang={props.route.lang} />;
        });
    }
    views.set(route.kind, view);
    return view;
}
