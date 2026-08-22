import sys

with open('api/index.ts', 'r') as f:
    content = f.read()

old_webhook = """          if (sub.status === 'authorized') {
             // Grant premium
             if (sub.external_reference) {
               const userId = sub.external_reference;
               const userRef = firestore.collection("users").doc(userId);
               await userRef.update({ 
                 isPremium: true, 
                 mpSubscriptionId: subId,
                 subscriptionStatus: sub.status,
                 cancelAtPeriodEnd: false
               });
             }
          } else {
            // Revoke premium if cancelled/expired
            const usersRef = firestore.collection("users");
            const snapshot = await usersRef.where("mpSubscriptionId", "==", subId).get();
            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              await doc.ref.update({ 
                isPremium: false, 
                subscriptionStatus: sub.status 
              });
            }
          }"""

new_webhook = """          if (sub.status === 'authorized') {
             // Grant premium
             if (sub.external_reference) {
               const userId = sub.external_reference;
               const userRef = firestore.collection("users").doc(userId);
               await userRef.update({ 
                 isPremium: true, 
                 mpSubscriptionId: subId,
                 subscriptionStatus: sub.status,
                 cancelAtPeriodEnd: false
               });
             }
          } else if (sub.status === 'cancelled') {
            const usersRef = firestore.collection("users");
            const snapshot = await usersRef.where("mpSubscriptionId", "==", subId).get();
            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              await doc.ref.update({ 
                subscriptionStatus: sub.status,
                cancelAtPeriodEnd: true
              });
            }
          } else {
            const usersRef = firestore.collection("users");
            const snapshot = await usersRef.where("mpSubscriptionId", "==", subId).get();
            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              await doc.ref.update({ 
                isPremium: false, 
                subscriptionStatus: sub.status 
              });
            }
          }"""

content = content.replace(old_webhook, new_webhook)

with open('api/index.ts', 'w') as f:
    f.write(content)
