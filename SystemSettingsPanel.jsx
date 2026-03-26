import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Image as ImageIcon, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import SystemLogo from '@/components/shared/SystemLogo';

export default function SystemSettingsPanel() {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: logoSetting } = useQuery({
    queryKey: ['systemSettings', 'company_logo'],
    queryFn: async () => {
      const result = await base44.entities.SystemSettings.filter({ setting_key: 'company_logo' });
      return result?.[0];
    },
  });

  const updateLogoMutation = useMutation({
    mutationFn: async (logoUrl) => {
      if (logoSetting) {
        return base44.entities.SystemSettings.update(logoSetting.id, {
          setting_value: logoUrl,
        });
      } else {
        return base44.entities.SystemSettings.create({
          setting_key: 'company_logo',
          setting_value: logoUrl,
          description: 'Company logo URL',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      toast.success('Logo atualizado com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar logo');
    },
  });

  const deleteLogoMutation = useMutation({
    mutationFn: async () => {
      if (logoSetting) {
        return base44.entities.SystemSettings.update(logoSetting.id, {
          setting_value: '',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      toast.success('Logo removido com sucesso');
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      await updateLogoMutation.mutateAsync(result.file_url);
    } catch (error) {
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-emerald-600" />
          Logo do Sistema
        </CardTitle>
        <CardDescription>
          Configure o logo que aparecerá em todas as páginas e documentos do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="mb-2 block">Logo Atual</Label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
            <SystemLogo size="large" showText={true} textSize="large" />
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="logo-upload">Upload Nova Imagem</Label>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="cursor-pointer"
              />
              <p className="mt-1 text-xs text-slate-500">
                Formatos aceitos: PNG, JPG, SVG (máx. 2MB)
              </p>
            </div>
          </div>
        </div>

        {logoSetting?.setting_value && (
          <div className="flex gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteLogoMutation.mutate()}
              disabled={deleteLogoMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remover Logo Personalizado
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> O logo será exibido em todas as páginas do sistema, incluindo:
            <ul className="ml-4 mt-2 list-disc">
              <li>Sidebar de navegação</li>
              <li>Modal de termos legais</li>
              <li>PDFs de payslips</li>
              <li>Todos os documentos gerados</li>
            </ul>
            <p className="mt-2">
              <strong>Sistema:</strong> Pay Track <span className="text-orange-500 font-bold">IE</span> - Payroll Control
            </p>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}