import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSendPush, useSendSms } from "../services/mutations";
import { Loader2, Send } from "lucide-react";

export function SendNotificationModal() {
  const [open, setOpen] = useState(false);
  const [pushUserId, setPushUserId] = useState("");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsMessage, setSmsMessage] = useState("");

  const { mutate: sendPush, isPending: isPushPending } =
    useSendPush();
  const { mutate: sendSms, isPending: isSmsPending } = useSendSms();

  const handleSendPush = (e: React.FormEvent) => {
    e.preventDefault();
    sendPush(
      { userId: pushUserId, title: pushTitle, body: pushBody },
      {
        onSuccess: () => {
          setPushUserId("");
          setPushTitle("");
          setPushBody("");
          setOpen(false);
        },
      },
    );
  };

  const handleSendSms = (e: React.FormEvent) => {
    e.preventDefault();
    sendSms(
      { phoneNumber: smsPhone, message: smsMessage },
      {
        onSuccess: () => {
          setSmsPhone("");
          setSmsMessage("");
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send size={16} />
          إرسال إشعار
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إرسال إشعار</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="push">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="push">إشعار دفع</TabsTrigger>
            <TabsTrigger value="sms">رسالة نصية</TabsTrigger>
          </TabsList>

          <TabsContent value="push">
            <form onSubmit={handleSendPush} className="space-y-4">
              <div>
                <Label htmlFor="pushUserId">معرف المستخدم</Label>
                <Input
                  id="pushUserId"
                  value={pushUserId}
                  onChange={(e) => setPushUserId(e.target.value)}
                  placeholder="معرف المستخدم"
                  required
                />
              </div>
              <div>
                <Label htmlFor="pushTitle">العنوان</Label>
                <Input
                  id="pushTitle"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="عنوان الإشعار"
                  required
                />
              </div>
              <div>
                <Label htmlFor="pushBody">الرسالة</Label>
                <Textarea
                  id="pushBody"
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  placeholder="نص الإشعار"
                  rows={4}
                  required
                />
              </div>
              <Button type="submit" disabled={isPushPending} className="w-full">
                {isPushPending && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                إرسال
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="sms">
            <form onSubmit={handleSendSms} className="space-y-4">
              <div>
                <Label htmlFor="smsPhone">رقم الهاتف</Label>
                <Input
                  id="smsPhone"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="+20xxxxxxxxx"
                  required
                />
              </div>
              <div>
                <Label htmlFor="smsMessage">الرسالة</Label>
                <Textarea
                  id="smsMessage"
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="نص الرسالة"
                  rows={4}
                  required
                />
              </div>
              <Button type="submit" disabled={isSmsPending} className="w-full">
                {isSmsPending && <Loader2 size={14} className="animate-spin" />}
                إرسال
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
