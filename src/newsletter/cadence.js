export const NEWSLETTER_TIME_ZONE = 'America/New_York';

export const PUBLICATIONS = {
  sunday: {
    key: 'devil-in-details',
    sectionKey: 'sunday',
    edition: 'sunday',
    label: 'Devil in the Details',
    weekday: 0,
    hour: 7,
    minute: 0,
    anchor: 'latest_final',
  },
  watercooler: {
    key: 'wallace-wade-watercooler',
    sectionKey: 'wallace-wade-watercooler',
    edition: 'watercooler',
    label: 'The Wallace Wade Watercooler',
    weekday: 3,
    hour: 12,
    minute: 0,
    anchor: 'latest_final',
  },
  bulletin: {
    key: 'victory-bell-bulletin',
    sectionKey: 'victory-bell-bulletin',
    edition: 'bulletin',
    label: 'The Victory Bell Bulletin',
    weekday: 5,
    hour: 9,
    minute: 0,
    anchor: 'next_scheduled',
  },
};

const WEEKDAYS = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getEasternParts(value = new Date()) {
  let date;
  try {
    date = value == null ? new Date(Number.NaN) : new Date(value);
  } catch {
    date = new Date(Number.NaN);
  }
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NEWSLETTER_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(safeDate);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return {
    weekday: WEEKDAYS[values.weekday],
    year: values.year,
    month: values.month,
    day: values.day,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export function publicationDateKey(value = new Date()) {
  const parts = getEasternParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isPublicationDue(publication, value = new Date()) {
  const parts = getEasternParts(value);
  const currentMinutes = (parts.hour * 60) + parts.minute;
  const targetMinutes = (publication.hour * 60) + publication.minute;
  return parts.weekday === publication.weekday && currentMinutes >= targetMinutes;
}

export function getDuePublications(value = new Date()) {
  return Object.values(PUBLICATIONS).filter((publication) => isPublicationDue(publication, value));
}
