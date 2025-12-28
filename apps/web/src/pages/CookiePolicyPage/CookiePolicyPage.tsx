import { LegalPage, type LegalSection } from "~/components/LegalPage/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Overview",
    paragraphs: [
      "This Cookie Policy explains how Looped Social (\"Looped\", Company, \"we,\" \"us,\" and \"our\") uses cookies and similar technologies to recognize you when you visit our website at https://www.mylooped.app (\"Website\"). It explains what these technologies are and why we use them, as well as your rights to control our use of them.",
      "In some cases we may use cookies to collect personal information, or that becomes personal information if we combine it with other information.",
    ],
  },
  {
    title: "What are cookies?",
    paragraphs: [
      "Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.",
      "Cookies set by the website owner (in this case, Looped) are called \"first-party cookies.\" Cookies set by parties other than the website owner are called \"third-party cookies.\" Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g., advertising, interactive content, and analytics). The parties that set these third-party cookies can recognize your computer both when it visits the website in question and also when it visits certain other websites.",
    ],
  },
  {
    title: "Why do we use cookies?",
    paragraphs: [
      "We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our Website to operate, and we refer to these as \"essential\" or \"strictly necessary\" cookies. Other cookies also enable us to track and target the interests of our users to enhance the experience on our Online Properties. Third parties serve cookies through our Website for advertising, analytics, and other purposes. This is described in more detail below.",
    ],
  },
  {
    title: "How can I control cookies?",
    paragraphs: [
      "You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by setting your preferences in the Cookie Consent Manager. The Cookie Consent Manager allows you to select which categories of cookies you accept or reject. Essential cookies cannot be rejected as they are strictly necessary to provide you with services.",
      "The Cookie Consent Manager can be found in the notification banner and on our Website. If you choose to reject cookies, you may still use our Website though your access to some functionality and areas of our Website may be restricted. You may also set or amend your web browser controls to accept or refuse cookies.",
      "The specific types of first- and third-party cookies served through our Website and the purposes they perform are described in the table below (please note that the specific cookies served may vary depending on the specific Online Properties you visit):",
    ],
  },
  {
    title: "Unclassified cookies",
    paragraphs: [
      "These are cookies that have not yet been categorized. We are in the process of classifying these cookies with the help of their providers.",
    ],
    bullets: [
      "Name: looped-theme",
      "Provider: www.mylooped.app",
      "Type: html_local_storage",
      "Expires in: persistent",
    ],
  },
  {
    title: "How can I control cookies on my browser?",
    paragraphs: [
      "As the means by which you can refuse cookies through your web browser controls vary from browser to browser, you should visit your browser's help menu for more information. The following is information about how to manage cookies on the most popular browsers:",
    ],
    bullets: ["Chrome", "Internet Explorer", "Firefox", "Safari", "Edge", "Opera"],
    subSections: [
      {
        title: "Opt-out options",
        paragraphs: [
          "In addition, most advertising networks offer you a way to opt out of targeted advertising. If you would like to find out more information, please visit:",
        ],
        bullets: [
          "Digital Advertising Alliance",
          "Digital Advertising Alliance of Canada",
          "European Interactive Digital Advertising Alliance",
        ],
      },
    ],
  },
  {
    title: "What about other tracking technologies, like web beacons?",
    paragraphs: [
      "Cookies are not the only way to recognize or track visitors to a website. We may use other, similar technologies from time to time, like web beacons (sometimes called \"tracking pixels\" or \"clear gifs\"). These are tiny graphics files that contain a unique identifier that enables us to recognize when someone has visited our Website or opened an email including them.",
      "This allows us, for example, to monitor the traffic patterns of users from one page within a website to another, to deliver or communicate with cookies, to understand whether you have come to the website from an online advertisement displayed on a third-party website, to improve site performance, and to measure the success of email marketing campaigns.",
      "In many instances, these technologies are reliant on cookies to function properly, and so declining cookies will impair their functioning.",
    ],
  },
  {
    title: "Do you use Flash cookies or Local Shared Objects?",
    paragraphs: [
      "Websites may also use so-called \"Flash Cookies\" (also known as Local Shared Objects or \"LSOs\") to, among other things, collect and store information about your use of our services, fraud prevention, and for other site operations.",
      "If you do not want Flash Cookies stored on your computer, you can adjust the settings of your Flash player to block Flash Cookies storage using the tools contained in the Website Storage Settings Panel. You can also control Flash Cookies by going to the Global Storage Settings Panel and following the instructions.",
      "Please note that setting the Flash Player to restrict or limit acceptance of Flash Cookies may reduce or impede the functionality of some Flash applications, including Flash applications used in connection with our services or online content.",
    ],
  },
  {
    title: "Do you serve targeted advertising?",
    paragraphs: [
      "Third parties may serve cookies on your computer or mobile device to serve advertising through our Website. These companies may use information about your visits to this and other websites in order to provide relevant advertisements about goods and services that you may be interested in.",
      "The information collected through this process does not enable us or them to identify your name, contact details, or other details that directly identify you unless you choose to provide these.",
    ],
  },
  {
    title: "How often will you update this Cookie Policy?",
    paragraphs: [
      "We may update this Cookie Policy from time to time in order to reflect changes to the cookies we use or for other operational, legal, or regulatory reasons. Please revisit this Cookie Policy regularly to stay informed.",
      "The date at the top of this Cookie Policy indicates when it was last updated.",
    ],
  },
  {
    title: "Where can I get further information?",
    paragraphs: [
      "If you have any questions about our use of cookies or other technologies, please contact us at:",
    ],
  },
];

export function CookiePolicyPage() {
  return <LegalPage title="Cookie Policy" lastUpdated="October 11, 2025" sections={sections} />;
}
