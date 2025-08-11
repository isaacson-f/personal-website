import { EventData, SessionData, VisitorData, PageViewData } from '../types';
declare global {
    var createTestData: {
        visitor: (overrides?: Partial<VisitorData>) => Partial<VisitorData>;
        session: (overrides?: Partial<SessionData>) => Partial<SessionData>;
        event: (overrides?: Partial<EventData>) => Partial<EventData>;
        pageView: (overrides?: Partial<PageViewData>) => Partial<PageViewData>;
    };
}
//# sourceMappingURL=setup.d.ts.map