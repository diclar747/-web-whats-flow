declare module 'react-big-calendar' {
  import * as React from 'react';
  
  export type View = 'month' | 'week' | 'work_week' | 'day' | 'agenda';
  
  export interface SlotInfo {
    start: Date;
    end: Date;
    slots: Date[];
    action: 'select' | 'click' | 'doubleClick';
  }
  
  export interface Event {
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: any;
  }
  
  export interface CalendarProps {
    localizer: any;
    events: Event[];
    view?: View;
    date?: Date;
    onView?: (view: View) => void;
    onNavigate?: (date: Date) => void;
    onSelectSlot?: (slotInfo: SlotInfo) => void;
    onSelectEvent?: (event: Event) => void;
    eventPropGetter?: (event: Event) => { style: React.CSSProperties };
    selectable?: boolean;
    messages?: any;
    style?: React.CSSProperties;
    views?: View[] | string[];
  }
  
  export class Calendar extends React.Component<CalendarProps> {}
  
  export function momentLocalizer(moment: any): any;
  export function dateFnsLocalizer(config: any): any;
}
