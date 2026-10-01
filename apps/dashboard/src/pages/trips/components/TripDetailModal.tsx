// ─── Trip Detail Modal ───────────────────────────────────────────────────────
// Shows full trip details with map, timeline, and admin actions.
// Real-time updates via WebSocket for live trip status changes.

import { useState } from 'react'
import { useTripUpdates } from '@/hooks/useTripUpdates'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useCancelTrip } from '../services/mutations'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Loader2, MapPin, Calendar, User, Car, Banknote } from 'lucide-react'
import type { Trip } from '../services/transformers'

interface TripDetailModalProps {
  trip: Trip | null
  open: boolean
  onClose: () => void
}

export function TripDetailModal({ trip, open, onClose }: TripDetailModalProps) {
  const { user } = useAuthStore()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const { mutate: cancelTrip, isPending } = useCancelTrip()
  useTripUpdates(trip?.id)

  if (!trip) return null

  const handleCancel = () => {
    // confirm is disabled until a reason is typed
    cancelTrip(
      {
        id: trip.id,
        reason: cancelReason.trim(),
        // the modal only renders inside the protected layout, so a session exists
        cancelledBy: user!.id,
      },
      {
        onSuccess: () => {
          setShowCancelDialog(false)
          setCancelReason('')
          onClose()
        },
      },
    )
  }

  const canCancel = trip.status === 'REQUESTED' || trip.status === 'MATCHED'

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الرحلة</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  المعرف
                </p>
                <p className="font-mono text-sm">{trip.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  الحالة
                </p>
                <StatusBadge status={trip.status} />
              </div>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  طريقة الدفع
                </p>
                <div className="flex items-center gap-1">
                  <Banknote size={14} style={{ color: 'var(--color-success)' }} />
                  <span className="text-sm">{trip.paymentMethodLabel}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  حالة الدفع
                </p>
                <StatusBadge status={trip.paymentStatus} />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="mt-1" style={{ color: 'var(--color-primary)' }} />
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                      نقطة الانطلاق
                    </p>
                    <p className="text-sm">{trip.pickupAddress}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                      {trip.pickupLat.toFixed(6)}, {trip.pickupLng.toFixed(6)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="mt-1" style={{ color: 'var(--color-destructive)' }} />
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                      الوجهة
                    </p>
                    <p className="text-sm">{trip.dropoffAddress}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                      {trip.dropoffLat.toFixed(6)}, {trip.dropoffLng.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <User size={16} className="mt-1" style={{ color: 'var(--color-foreground)' }} />
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                      الراكب
                    </p>
                    <p className="text-sm font-mono">{trip.riderId.slice(0, 8)}</p>
                  </div>
                </div>
                {trip.driverId && (
                  <div className="flex items-start gap-2">
                    <Car size={16} className="mt-1" style={{ color: 'var(--color-foreground)' }} />
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        السائق
                      </p>
                      <p className="text-sm font-mono">{trip.driverId.slice(0, 8)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  التكلفة المقدرة
                </p>
                <p className="text-lg font-bold">{formatCurrency(trip.estimatedFare)}</p>
              </div>
              {trip.actualFare && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                    التكلفة الفعلية
                  </p>
                  <p className="text-lg font-bold">{formatCurrency(trip.actualFare)}</p>
                </div>
              )}
              {trip.promoCode && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                    كود الخصم
                  </p>
                  <p className="text-sm font-mono">{trip.promoCode}</p>
                  <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
                    -{formatCurrency(trip.promoDiscount)}
                  </p>
                </div>
              )}
            </div>

            {(trip.distance || trip.duration) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  {trip.distance && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        المسافة
                      </p>
                      <p className="text-sm">{(trip.distance / 1000).toFixed(2)} كم</p>
                    </div>
                  )}
                  {trip.duration && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        المدة
                      </p>
                      <p className="text-sm">{Math.floor(trip.duration / 60)} دقيقة</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">الجدول الزمني</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} style={{ color: 'var(--color-muted-foreground)' }} />
                  <span className="font-medium">طلب الرحلة:</span>
                  <span>{formatDate(trip.requestedAt)}</span>
                </div>
                {trip.matchedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} style={{ color: 'var(--color-muted-foreground)' }} />
                    <span className="font-medium">تم التوصيل:</span>
                    <span>{formatDate(trip.matchedAt)}</span>
                  </div>
                )}
                {trip.startedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} style={{ color: 'var(--color-muted-foreground)' }} />
                    <span className="font-medium">بدأت الرحلة:</span>
                    <span>{formatDate(trip.startedAt)}</span>
                  </div>
                )}
                {trip.completedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} style={{ color: 'var(--color-muted-foreground)' }} />
                    <span className="font-medium">انتهت الرحلة:</span>
                    <span>{formatDate(trip.completedAt)}</span>
                  </div>
                )}
                {trip.cancelledAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} style={{ color: 'var(--color-muted-foreground)' }} />
                    <span className="font-medium">تم الإلغاء:</span>
                    <span>{formatDate(trip.cancelledAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {trip.cancellationReason && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                    سبب الإلغاء
                  </p>
                  <p className="text-sm">{trip.cancellationReason}</p>
                  {trip.cancelledBy && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                      تم الإلغاء بواسطة: {trip.cancelledBy.slice(0, 8)}
                    </p>
                  )}
                </div>
              </>
            )}

            {(trip.driverRating || trip.riderRating) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  {trip.driverRating && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        تقييم السائق
                      </p>
                      <p className="text-lg font-bold">{trip.driverRating.toFixed(1)} ⭐</p>
                    </div>
                  )}
                  {trip.riderRating && (
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        تقييم الراكب
                      </p>
                      <p className="text-lg font-bold">{trip.riderRating.toFixed(1)} ⭐</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {canCancel && (
              <>
                <Separator />
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  className="w-full"
                >
                  إلغاء الرحلة
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء الرحلة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء هذه الرحلة؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancelReason">سبب الإلغاء</Label>
            <Textarea
              id="cancelReason"
              placeholder="اكتب سبب الإلغاء..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={!cancelReason.trim() || isPending}
              style={{ backgroundColor: 'var(--color-destructive)' }}
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              تأكيد الإلغاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
