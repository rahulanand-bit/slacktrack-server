export type SlackUserNotificationSeed = {
  name: string;
  email: string | null;
  slackId: string;
  isMessageEnabled: boolean;
};

const rawSlackUserNotificationSeed: Array<Omit<SlackUserNotificationSeed, 'isMessageEnabled'> & { isMessageEnabled?: boolean }> = 
[
  {
    name: "Rahul Anand",
    email: 'rahul.anand@caw.tech.com',
    slackId: 'U0A5YQ63CMT',
    isMessageEnabled: true
  }
]

export const slackUserNotificationSeed: SlackUserNotificationSeed[] = rawSlackUserNotificationSeed.map((user) => ({
  ...user,
  isMessageEnabled: user.isMessageEnabled ?? true
}));
